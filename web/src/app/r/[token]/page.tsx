// Página pública de relatório — acessada sem login via /r/[token].
// Renderiza a partir do `snapshot` (JSONB) que foi capturado da Meta API
// no momento da geração — valores batem 100% com o Ads Manager.

import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { formatarPeriodoLabel, type TipoRelatorio } from "@/lib/relatorios";
import { getCrmFunilDetalhado, getCrmLeadsAtribuicaoCompleta, getPanfletagemInsights } from "@/lib/db-insights";
import { PanfletagemResumo } from "@/components/panfletagem/resumo";
import { EnviarRelatorioButton } from "./_enviar-relatorio-button";
import type {
  Snapshot,
  CampanhaSnapshot,
  AdsetSnapshot,
  AdSnapshot,
  ResultadoMeta,
  InstagramSnapshot,
} from "@/lib/meta-snapshot";
import { RelatorioHierarquia } from "./_relatorio-hierarquia";
import { LeadsAtribuicao } from "@/components/crm/leads-atribuicao";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function fBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
function fInt(v: number): string {
  return new Intl.NumberFormat("pt-BR").format(Math.round(v));
}
function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Mensagem de saudação natural pro WhatsApp, varia conforme o tipo de relatório. */
function construirSaudacaoWhatsApp(tipo: TipoRelatorio, from: string, to: string): string {
  const meses = ["janeiro","fevereiro","março","abril","maio","junho",
                 "julho","agosto","setembro","outubro","novembro","dezembro"];
  if (tipo === "mensal") {
    const [y, m] = from.split("-").map(Number);
    return `Olá! 📊 Esse é o seu relatório de performance referente a *${meses[m - 1]} de ${y}*.`;
  }
  const fmt = (iso: string) => { const [, m, d] = iso.split("-"); return `${d}/${m}`; };
  const periodo = tipo === "semanal" ? "última semana" : "últimos 15 dias";
  return `Olá! 📊 Esse é o seu relatório de performance da *${periodo}* (${fmt(from)} a ${fmt(to)}).`;
}

type Props = { params: Promise<{ token: string }> };

export default async function RelatorioPublicoPage({ params }: Props) {
  const { token } = await params;

  const relatorio = await db.relatorioPublico.findUnique({
    where: { token },
    include: { cliente: true },
  });

  if (!relatorio || relatorio.revogado) notFound();
  if (relatorio.expiraEm && relatorio.expiraEm.getTime() < Date.now()) notFound();

  // Detecta se quem tá vendo é da agência (logado). Esse check NÃO bloqueia
  // o acesso — só decide se mostramos controles de agência (botão de enviar).
  const session   = await auth();
  const ehAgencia = !!session?.user?.email;

  const from = relatorio.dateFrom.toISOString().slice(0, 10);
  const to   = relatorio.dateTo.toISOString().slice(0, 10);
  const tipo = relatorio.tipo as TipoRelatorio;
  const periodoLabel = formatarPeriodoLabel(tipo, from, to);
  const saudacaoWhatsApp = construirSaudacaoWhatsApp(tipo, from, to);

  // ── CRM + Panfletagem (live queries — sempre atualizados) ────────────────
  const clientKey     = relatorio.cliente.n8nClientKey;
  const ehPanfletagem = relatorio.cliente.tipoServico === "panfletagem_digital";

  const [crmFunil, leadsAtribuicao, panfletagemData] = clientKey
    ? await Promise.all([
        getCrmFunilDetalhado(clientKey, from, to),
        getCrmLeadsAtribuicaoCompleta(clientKey, from, to),
        ehPanfletagem
          ? getPanfletagemInsights(clientKey, from, to)
          : Promise.resolve(null),
      ])
    : [null, [] as Awaited<ReturnType<typeof getCrmLeadsAtribuicaoCompleta>>, null];

  const totalLeadsCampanha = leadsAtribuicao.reduce((s, l) => s + l.leads, 0);

  const snapshot = relatorio.snapshot as unknown as Snapshot | null;
  const campanhas = (snapshot?.campanhas ?? []).filter((c) => c.spend > 0);
  const adsets    = (snapshot?.adsets    ?? []).filter((a) => a.spend > 0);
  const ads       = (snapshot?.ads       ?? []).filter((a) => a.spend > 0);
  const igContas  = (snapshot?.instagram ?? []).filter(
    (i): i is InstagramSnapshot => i.novosSeguidores !== null,
  );

  // ─── Totais ────────────────────────────────────────────────────────────────
  const totalSpend       = round2(campanhas.reduce((s, c) => s + c.spend, 0));
  const totalImpressions = campanhas.reduce((s, c) => s + c.impressions, 0);
  const totalClicks      = campanhas.reduce((s, c) => s + c.clicks, 0);
  // Reach total = soma dos reach per-campaign (já é deduplicado dentro de cada campanha
  // no período inteiro). Cross-campaign pode ter sobreposição, mas é a melhor aproximação
  // sem fazer query "todas as campanhas juntas" agregada.
  const totalReach       = campanhas.reduce((s, c) => s + c.reach, 0);
  const ctrMedio = totalImpressions > 0 ? round2((totalClicks / totalImpressions) * 100) : 0;
  const cpcMedio = totalClicks > 0 ? round2(totalSpend / totalClicks) : 0;

  // Cards de resultado: agrega métricas (principal + secundárias) por label final.
  // Custo médio é calculado APENAS do principal (onde tem cost_per_result real).
  type AgRes = {
    label: string;
    valorTotal: number;
    spendPrimario: number; // só onde label foi principal
    valorPrimario: number; // ditto
  };
  const agPorLabel = new Map<string, AgRes>();
  function addAg(label: string, valor: number, ehPrimario: boolean, spend: number) {
    if (valor <= 0) return;
    const cur = agPorLabel.get(label) ?? { label, valorTotal: 0, spendPrimario: 0, valorPrimario: 0 };
    cur.valorTotal += valor;
    if (ehPrimario) {
      cur.spendPrimario += spend;
      cur.valorPrimario += valor;
    }
    agPorLabel.set(label, cur);
  }
  for (const c of campanhas) {
    if (c.resultado && c.resultado.valor > 0) {
      addAg(c.resultado.label, c.resultado.valor, true, c.spend);
    }
    for (const s of c.secundarias) {
      addAg(s.label, s.valor, false, 0);
    }
  }
  const ORDEM_LABEL: Record<string, { tone: "amber" | "emerald" | "blue" | "violet"; ordem: number }> = {
    "Compras":             { tone: "amber",   ordem: 0 },
    "Conversas iniciadas": { tone: "emerald", ordem: 1 },
    "Novos seguidores":    { tone: "violet",  ordem: 2 },
    "Visitas ao perfil":   { tone: "violet",  ordem: 3 },
    "Cliques no link":     { tone: "blue",    ordem: 4 },
    "Alcance":             { tone: "blue",    ordem: 5 },
  };
  const cardsResultado = Array.from(agPorLabel.values())
    .map((a) => ({
      ...a,
      custoPorRes: a.valorPrimario > 0 ? round2(a.spendPrimario / a.valorPrimario) : null,
      tone: ORDEM_LABEL[a.label]?.tone ?? "blue",
      ordem: ORDEM_LABEL[a.label]?.ordem ?? 99,
    }))
    .sort((a, b) => a.ordem - b.ordem);

  // ─── Anúncio Campeão — seleção em 3 tiers ────────────────────────────────
  //
  //  Tier 1 (CRM): anúncio com mais "Concluído" pelo menor custo
  //  Tier 2 (CRM): anúncio com mais leads CRM pelo menor custo
  //  Tier 3 (fallback): mais resultado Meta pelo menor custo (comportamento anterior)
  //
  //  Score = valor² / spend  (penaliza custo, premia volume — ties favorecem quem tem mais)

  type CampeaoTipo = "crm_concluidos" | "crm_leads" | "meta_resultado";
  type CampeaoInfo = {
    ad:       AdSnapshot;
    tipo:     CampeaoTipo;
    crmStats: { concluidos: number; totalLeads: number } | undefined;
  };

  const campeaoInfo = ((): CampeaoInfo | null => {
    // Constrói mapa adId → { concluidos, totalLeads } a partir da atribuição CRM
    const crmPorAd = new Map<string, { concluidos: number; totalLeads: number }>();
    for (const l of leadsAtribuicao) {
      const s = crmPorAd.get(l.adId) ?? { concluidos: 0, totalLeads: 0 };
      s.totalLeads += l.leads;
      if (l.fase.toLowerCase().includes("conclu")) s.concluidos += l.leads;
      crmPorAd.set(l.adId, s);
    }

    const base = ads.filter((a) => a.spend > 0);
    if (base.length === 0) return null;

    function melhorPorScore(lista: AdSnapshot[], score: (a: AdSnapshot) => number): AdSnapshot {
      return lista.reduce((best, a) => score(a) > score(best) ? a : best);
    }

    // Tier 1: Concluídos CRM
    const comConcluidos = base.filter((a) => (crmPorAd.get(a.adId)?.concluidos ?? 0) > 0);
    if (comConcluidos.length > 0) {
      const ad = melhorPorScore(comConcluidos,
        (a) => (crmPorAd.get(a.adId)!.concluidos ** 2) / a.spend,
      );
      return { ad, tipo: "crm_concluidos", crmStats: crmPorAd.get(ad.adId) };
    }

    // Tier 2: Quaisquer leads CRM atribuídos
    const comLeads = base.filter((a) => (crmPorAd.get(a.adId)?.totalLeads ?? 0) > 0);
    if (comLeads.length > 0) {
      const ad = melhorPorScore(comLeads,
        (a) => (crmPorAd.get(a.adId)!.totalLeads ** 2) / a.spend,
      );
      return { ad, tipo: "crm_leads", crmStats: crmPorAd.get(ad.adId) };
    }

    // Tier 3: Resultado Meta (fallback — sem CRM ou sem atribuição)
    const comResultado = base.filter((a) => a.resultado && a.resultado.valor > 0);
    if (comResultado.length === 0) return null;
    const ad = melhorPorScore(comResultado,
      (a) => (a.resultado!.valor ** 2) / a.spend,
    );
    return { ad, tipo: "meta_resultado", crmStats: undefined };
  })();

  // ─── Tipo dominante (pra subtítulo do relatório) ───────────────────────────
  const tipoDominante = cardsResultado[0]?.label ?? "Resultados";

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* ── Barra da agência (só visível para usuários logados) ─────────── */}
      {ehAgencia && (
        <div className="border-b border-neutral-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 md:px-6">
            <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
              👁 Visão da agência
            </p>
            <EnviarRelatorioButton
              phone={relatorio.cliente.whatsappAlerta}
              mensagemPrefix={saudacaoWhatsApp}
            />
          </div>
        </div>
      )}

      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
        {/* ── Cabeçalho ─────────────────────────────────────────────────── */}
        <header className="mb-8 rounded-2xl bg-gradient-to-br from-neutral-900 to-neutral-700 px-6 py-7 text-white shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-neutral-300">Relatório de Performance</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
                {relatorio.cliente.nome}
              </h1>
              {relatorio.cliente.empresa && (
                <p className="mt-0.5 text-sm text-neutral-300">{relatorio.cliente.empresa}</p>
              )}
              <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                {periodoLabel}
              </p>
            </div>
            <div className="hidden text-right md:block">
              <p className="text-xs uppercase tracking-wider text-neutral-300">Agência</p>
              <p className="mt-1 text-base font-medium">Impulso</p>
            </div>
          </div>
        </header>

        {/* ── Resumo principal: Panfletagem ou Meta Ads ─────────────────── */}
        {ehPanfletagem ? (
          <section className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />
              <h2 className="text-sm font-semibold text-neutral-700">Panfletagem Digital — Resumo</h2>
            </div>
            {panfletagemData ? (
              <PanfletagemResumo
                dados={panfletagemData}
                seguidores={igContas[0]?.novosSeguidores ?? null}
              />
            ) : (
              <div className="rounded-xl border border-neutral-200 bg-white px-6 py-10 text-center text-sm text-neutral-500">
                Sem dados de panfletagem no período.
              </div>
            )}
          </section>
        ) : (
          <section className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />
              <h2 className="text-sm font-semibold text-neutral-700">Meta Ads — Resumo</h2>
            </div>

            {campanhas.length === 0 ? (
              <div className="rounded-xl border border-neutral-200 bg-white px-6 py-10 text-center text-sm text-neutral-500">
                Sem dados de Meta Ads no período.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  <KpiCard label="Investimento" value={fBRL(totalSpend)} highlight />
                  {cardsResultado.map((c) => (
                    <ResultadoCard
                      key={c.label}
                      label={c.label}
                      valor={fInt(c.valorTotal)}
                      custoMedio={c.custoPorRes !== null ? fBRL(c.custoPorRes) : null}
                      tone={c.tone}
                    />
                  ))}

                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <KpiCard label="Alcance"     value={totalReach > 0 ? fInt(totalReach) : "—"} />
                  <KpiCard label="Cliques"     value={fInt(totalClicks)} />
                  <KpiCard label="CTR"         value={ctrMedio > 0 ? `${ctrMedio.toFixed(2)}%` : "—"} />
                  <KpiCard label="CPC médio"   value={cpcMedio > 0 ? fBRL(cpcMedio) : "—"} />
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── Visão geral do Instagram ──────────────────────────────────── */}
        {igContas.length > 0 && (
          <section className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-lg">📸</span>
              <h2 className="text-sm font-semibold text-neutral-700">Visão geral do Instagram</h2>
              <span className="text-[11px] text-neutral-400">
                Conta inteira no período (orgânico + pago)
              </span>
            </div>
            {igContas.map((ig) => (
              <div
                key={ig.igAccountId}
                className="overflow-hidden rounded-2xl border border-pink-200 bg-gradient-to-br from-pink-50 via-white to-white shadow-sm"
              >
                <div className="grid gap-px bg-pink-100/60 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
                  <div className="bg-white p-4">
                    <p className="text-[10px] uppercase tracking-wider text-pink-700">Perfil</p>
                    <p className="mt-1 text-base font-semibold text-neutral-900">@{ig.username}</p>
                    {ig.seguidoresFinal !== null && (
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {fInt(ig.seguidoresFinal)} seguidores totais
                      </p>
                    )}
                  </div>
                  <ChampionStat
                    label="Novos seguidores"
                    value={
                      ig.novosSeguidores === null
                        ? "—"
                        : `${ig.novosSeguidores >= 0 ? "+" : ""}${fInt(ig.novosSeguidores)}`
                    }
                    tone={(ig.novosSeguidores ?? 0) > 0 ? "emerald" : "neutral"}
                    highlight
                  />
                  <ChampionStat
                    label="Visitas ao perfil"
                    value={ig.visitasPerfil === null ? "—" : fInt(ig.visitasPerfil)}
                    sub="conta inteira"
                  />
                  <ChampionStat
                    label="Final do período"
                    value={ig.seguidoresFinal === null ? "—" : fInt(ig.seguidoresFinal)}
                    sub="total acumulado"
                  />
                </div>
              </div>
            ))}
          </section>
        )}

        {/* ── Funil CRM ────────────────────────────────────────────────── */}
        {crmFunil && crmFunil.totalLeads > 0 && (
          <section className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-violet-500" />
              <h2 className="text-sm font-semibold text-neutral-700">Funil CRM</h2>
              <span className="text-[11px] text-neutral-400">Leads criados no período</span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <KpiCard
                label="Total de leads"
                value={fInt(crmFunil.totalLeads)}
                tone="ok"
                highlight
              />
              {crmFunil.porFase.map((p) => {
                const ehPositivo =
                  p.fase.toLowerCase().includes("qualificad") ||
                  p.fase.toLowerCase().includes("concluido")  ||
                  p.fase.toLowerCase().includes("concluído");
                return (
                  <KpiCard
                    key={p.fase}
                    label={p.fase}
                    value={fInt(p.qtd)}
                    tone={ehPositivo && p.qtd > 0 ? "ok" : "default"}
                  />
                );
              })}
            </div>

            {leadsAtribuicao.length > 0 ? (
              <LeadsAtribuicao
                dados={leadsAtribuicao}
                totalLeads={totalLeadsCampanha}
                totalGeral={crmFunil.totalLeads}
              />
            ) : (
              <p className="mt-3 text-xs text-neutral-400">
                💡 Nenhum lead deste período possui atribuição de anúncio — os leads podem ter vindo de tráfego orgânico, Google Ads ou formulários sem rastreamento Meta ativo.
              </p>
            )}
          </section>
        )}

        {/* ── Anúncio Campeão ──────────────────────────────────────────── */}
        {!ehPanfletagem && campeaoInfo && (
          <section className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-lg">🏆</span>
              <h2 className="text-sm font-semibold text-neutral-700">Anúncio Campeão</h2>
              <span className="text-[11px] text-neutral-400">
                {campeaoInfo.tipo === "crm_concluidos"
                  ? "Mais negócios concluídos pelo menor custo"
                  : campeaoInfo.tipo === "crm_leads"
                  ? "Mais leads pelo menor custo"
                  : `Mais ${tipoDominante.toLowerCase()} pelo menor custo`}
              </span>
              {campeaoInfo.tipo !== "meta_resultado" && (
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-700">
                  via CRM
                </span>
              )}
            </div>
            <div className="overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-white shadow-sm">
              <div className="grid gap-0 md:grid-cols-[2fr_3fr]">
                <div className="border-b border-amber-100 p-5 md:border-b-0 md:border-r">
                  <p className="text-[10px] uppercase tracking-wider text-amber-700">Anúncio</p>
                  <h3 className="mt-1 text-base font-semibold text-neutral-900" title={campeaoInfo.ad.adName}>
                    {campeaoInfo.ad.adName}
                  </h3>
                  <dl className="mt-3 space-y-1.5 text-xs text-neutral-600">
                    <div className="flex gap-2">
                      <dt className="w-20 shrink-0 text-neutral-400">Campanha</dt>
                      <dd className="truncate text-neutral-700" title={campeaoInfo.ad.campaignName}>
                        {campeaoInfo.ad.campaignName}
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-20 shrink-0 text-neutral-400">Conjunto</dt>
                      <dd className="truncate text-neutral-700" title={campeaoInfo.ad.adsetName}>
                        {campeaoInfo.ad.adsetName}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="grid grid-cols-2 gap-px bg-amber-100/60 md:grid-cols-4">
                  {campeaoInfo.tipo === "crm_concluidos" ? (
                    <>
                      <ChampionStat
                        label="Negócios concluídos"
                        value={fInt(campeaoInfo.crmStats!.concluidos)}
                        tone="amber"
                        highlight
                      />
                      <ChampionStat
                        label="Custo / concluído"
                        value={fBRL(round2(campeaoInfo.ad.spend / campeaoInfo.crmStats!.concluidos))}
                        tone="emerald"
                        highlight
                      />
                    </>
                  ) : campeaoInfo.tipo === "crm_leads" ? (
                    <>
                      <ChampionStat
                        label="Leads CRM"
                        value={fInt(campeaoInfo.crmStats!.totalLeads)}
                        tone="amber"
                        highlight
                      />
                      <ChampionStat
                        label="Custo / lead"
                        value={fBRL(round2(campeaoInfo.ad.spend / campeaoInfo.crmStats!.totalLeads))}
                        tone="emerald"
                        highlight
                      />
                    </>
                  ) : (
                    <>
                      <ChampionStat
                        label={campeaoInfo.ad.resultado!.label}
                        value={fInt(campeaoInfo.ad.resultado!.valor)}
                        tone="amber"
                        highlight
                        sub={
                          campeaoInfo.ad.secundarias.length > 0
                            ? campeaoInfo.ad.secundarias.map((s) => `+${fInt(s.valor)} ${s.label.toLowerCase()}`).join(" · ")
                            : undefined
                        }
                      />
                      <ChampionStat
                        label="Custo / resultado"
                        value={fBRL(campeaoInfo.ad.resultado!.custoPorResultado)}
                        tone="emerald"
                        highlight
                      />
                    </>
                  )}
                  <ChampionStat label="Investimento" value={fBRL(campeaoInfo.ad.spend)} />
                  <ChampionStat
                    label="CTR"
                    value={campeaoInfo.ad.ctr > 0 ? `${campeaoInfo.ad.ctr.toFixed(2)}%` : "—"}
                    sub={campeaoInfo.ad.clicks > 0 ? `${fInt(campeaoInfo.ad.clicks)} cliques` : undefined}
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── Detalhamento ─────────────────────────────────────────────── */}
        {!ehPanfletagem && campanhas.length > 0 && (
          <section className="mb-8">
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />
              <h2 className="text-sm font-semibold text-neutral-700">Meta Ads — Detalhamento</h2>
              <span className="text-xs text-neutral-400">
                {campanhas.length} campanha{campanhas.length > 1 ? "s" : ""}
              </span>
            </div>
            <RelatorioHierarquia campanhas={campanhas} adsets={adsets} ads={ads} />
          </section>
        )}

        {/* ── Rodapé ───────────────────────────────────────────────────── */}
        <footer className="mt-10 border-t border-neutral-200 pt-5 text-center text-xs text-neutral-400">
          Relatório gerado pela <span className="font-medium text-neutral-600">Plataforma Impulso</span>{" "}
          · {new Date(relatorio.criadoEm).toLocaleDateString("pt-BR")}
          {snapshot?.geradoEm && (
            <span className="text-neutral-300">
              {" "}· dados Meta capturados em {new Date(snapshot.geradoEm).toLocaleString("pt-BR")}
            </span>
          )}
        </footer>
      </div>
    </div>
  );
}

// ─── Componentes ──────────────────────────────────────────────────────────────

function ResultadoCard({
  label, valor, custoMedio, tone,
}: {
  label: string;
  valor: string;
  custoMedio: string | null;
  tone: "amber" | "emerald" | "blue" | "violet";
}) {
  // Ícone por label (não só por tone) pra diferenciar Novos seguidores vs Visitas ao perfil
  const ICON_POR_LABEL: Record<string, string> = {
    "Compras":             "🛒",
    "Leads":               "📋",
    "Conversas iniciadas": "💬",
    "Novos seguidores":    "🎉",
    "Visitas ao perfil":   "👤",
    "Cliques no link":     "🔗",
  };
  const styles = {
    amber:   { border: "border-amber-200",   valor: "text-amber-700"   },
    emerald: { border: "border-emerald-200", valor: "text-emerald-700" },
    blue:    { border: "border-blue-200",    valor: "text-blue-700"    },
    violet:  { border: "border-violet-200",  valor: "text-violet-700"  },
  }[tone];
  const icon = ICON_POR_LABEL[label] ?? "📊";
  return (
    <div className={`rounded-xl border ${styles.border} bg-white p-4`}>
      <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-neutral-500">
        <span>{icon}</span> {label}
      </p>
      <p className={`mt-1 text-lg font-semibold ${styles.valor}`}>{valor}</p>
      {custoMedio && <p className="mt-0.5 text-[10px] text-neutral-400">{custoMedio}/resultado</p>}
    </div>
  );
}

function ChampionStat({
  label, value, sub, tone = "neutral", highlight = false,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "neutral" | "amber" | "emerald";
  highlight?: boolean;
}) {
  const valueClass =
    tone === "amber"   ? "text-amber-700"
    : tone === "emerald" ? "text-emerald-700"
    : "text-neutral-900";
  return (
    <div className="bg-white p-4">
      <p className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={`mt-1 font-semibold ${highlight ? "text-xl" : "text-base"} ${valueClass}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-neutral-400">{sub}</p>}
    </div>
  );
}

function KpiCard({
  label, value, tone = "default", highlight = false,
}: {
  label: string;
  value: string;
  tone?: "default" | "ok";
  highlight?: boolean;
}) {
  const border = highlight ? (tone === "ok" ? "border-emerald-200" : "border-blue-200") : "border-neutral-200";
  return (
    <div className={`rounded-xl border ${border} bg-white p-4`}>
      <p className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${tone === "ok" ? "text-emerald-700" : "text-neutral-900"}`}>{value}</p>
    </div>
  );
}

// Re-export types pra tabela usar (precisa ser linkable)
export type { CampanhaSnapshot, AdsetSnapshot, AdSnapshot, ResultadoMeta };
