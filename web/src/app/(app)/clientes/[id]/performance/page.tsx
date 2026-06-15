// Página de detalhe de performance por cliente.
// Meta Ads: tabela por campanha do banco (spend, resultado, cliques, CTR, CPC, impressões, alcance, frequência).
// Google Ads: KPIs agregados + breakdown por conta (banco).
// CRM: funil (leads / qualificados / perdidos / concluídos) via banco direto.

import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { defaultRange } from "@/lib/performance";
import { DateFilter } from "@/app/(app)/_date-filter";
import {
  getCrmFunilDetalhado,
  getCrmLeadsPorCampanha,
  getCrmLeadsAtribuicaoCompleta,
  getMetaInsightsPorCampanhaDB,
  getMetaAdsetsDB,
  getMetaAdsDB,
  getGoogleInsightsDBPorCustomerIds,
  type CrmFunilDetalhado,
  type LeadCampanha,
  type LeadAtribuicaoDetalhe,
  type MetaCampanhaDB,
} from "@/lib/db-insights";
import { MetaHierarquia } from "./_meta-hierarquia";
import { LeadsAtribuicao } from "@/components/crm/leads-atribuicao";
import { GerarRelatorioButton } from "./_gerar-relatorio";
import { listarMesesRecentes, mesAtualEmCurso } from "@/lib/relatorios";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ─── Helpers de formato ───────────────────────────────────────────────────────

function formatBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v);
}

function formatInt(v: number): string {
  return new Intl.NumberFormat("pt-BR").format(Math.round(v));
}

function formatPct(v: number): string {
  return `${v.toFixed(2)}%`;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

// ─── Tipos internos ───────────────────────────────────────────────────────────

type GoogleContaResult = {
  contaId: number;
  contaNome: string;
  customerId: string;
  spend: number;
  impressoes: number;
  cliques: number;
  ctr: number;
  cpc: number;
  conversoes: number;
  taxaConversao: number;
  erro: string | null;
};

// ─── Helpers de data ──────────────────────────────────────────────────────────

function isValidIso(s: string | undefined): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function formatDateBR(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PerformancePage({ params, searchParams }: Props) {
  const { id } = await params;
  const clienteId = Number(id);
  if (Number.isNaN(clienteId)) notFound();

  const sp = await searchParams;
  const def = defaultRange();
  const from = isValidIso(sp.from) ? sp.from : def.from;
  const to   = isValidIso(sp.to)   ? sp.to   : def.to;

  const cliente = await db.cliente.findUnique({
    where: { id: clienteId },
    include: {
      contas: {
        where: { ativo: true },
        select: {
          id: true,
          nome: true,
          metaAdAccountId: true,
          googleAdCustomerId: true,
        },
        orderBy: { nome: "asc" },
      },
    },
  });
  if (!cliente) notFound();

  const contasMeta    = cliente.contas.filter((c) => c.metaAdAccountId);
  const contasGoogle  = cliente.contas.filter((c) => c.googleAdCustomerId);
  const temCrm        = !!cliente.n8nClientKey;
  const clientKey     = cliente.n8nClientKey ?? "";

  const googleCustomerIds = contasGoogle.map((c) =>
    c.googleAdCustomerId!.replace(/-/g, ""),
  );

  // Busca tudo em paralelo — tudo via banco
  const [campanhasMeta, adsetsMeta, adsMeta, googleDbMap, crmFunil, leadsParaCampanha, leadsAtribuicao] =
    await Promise.all([
      contasMeta.length > 0 || temCrm
        ? getMetaInsightsPorCampanhaDB(clientKey, from, to)
        : Promise.resolve([] as MetaCampanhaDB[]),

      temCrm ? getMetaAdsetsDB(clientKey, from, to) : Promise.resolve([]),
      temCrm ? getMetaAdsDB(clientKey, from, to)    : Promise.resolve([]),

      getGoogleInsightsDBPorCustomerIds(googleCustomerIds, from, to),

      temCrm
        ? getCrmFunilDetalhado(clientKey, from, to)
        : Promise.resolve(null as CrmFunilDetalhado | null),

      temCrm
        ? getCrmLeadsPorCampanha(clientKey, from, to)
        : Promise.resolve([] as LeadCampanha[]),

      temCrm
        ? getCrmLeadsAtribuicaoCompleta(clientKey, from, to)
        : Promise.resolve([] as LeadAtribuicaoDetalhe[]),
    ]);

  // Mapa campanhaId → leads CRM
  const leadsMap = new Map<string, number>(
    leadsParaCampanha.map((l) => [l.campanhaId, l.leads]),
  );
  const totalLeadsCampanha = leadsParaCampanha.reduce((s, l) => s + l.leads, 0);

  // Totais Meta
  const metaTotal = campanhasMeta.reduce(
    (acc, c) => {
      acc.spend      += c.spend;
      acc.impressoes += c.impressoes;
      acc.cliques    += c.cliques;
      acc.reach      += c.reach;
      acc.conversoes += c.conversoes;
      return acc;
    },
    { spend: 0, impressoes: 0, cliques: 0, reach: 0, conversoes: 0 },
  );

  // Resultados Google por conta
  const googleResultsBrutos: GoogleContaResult[] = contasGoogle.map((c) => {
    const normalId   = c.googleAdCustomerId!.replace(/-/g, "");
    const data       = googleDbMap.get(normalId);
    const spend      = data?.spend      ?? 0;
    const impressoes = data?.impressoes ?? 0;
    const cliques    = data?.cliques    ?? 0;
    const conversoes = data?.conversoes ?? 0;
    return {
      contaId:       c.id,
      contaNome:     c.nome,
      customerId:    c.googleAdCustomerId!,
      spend, impressoes, cliques, conversoes,
      ctr:           impressoes > 0 ? round2((cliques / impressoes) * 100) : 0,
      cpc:           cliques > 0 ? round2(spend / cliques) : 0,
      taxaConversao: cliques > 0 ? round2((conversoes / cliques) * 100) : 0,
      erro:          null,
    };
  });

  const googleTotal = googleResultsBrutos.reduce(
    (acc, r) => {
      acc.spend      += r.spend;
      acc.impressoes += r.impressoes;
      acc.cliques    += r.cliques;
      acc.conversoes += r.conversoes;
      return acc;
    },
    { spend: 0, impressoes: 0, cliques: 0, conversoes: 0 },
  );
  const googleCtr          = googleTotal.impressoes > 0 ? round2((googleTotal.cliques / googleTotal.impressoes) * 100) : 0;
  const googleCpc          = googleTotal.cliques > 0 ? round2(googleTotal.spend / googleTotal.cliques) : 0;
  const googleTaxaConv     = googleTotal.cliques > 0 ? round2((googleTotal.conversoes / googleTotal.cliques) * 100) : 0;
  const googleCustoConv    = googleTotal.conversoes > 0 ? round2(googleTotal.spend / googleTotal.conversoes) : 0;

  return (
    <div className="space-y-8">
      {/* Breadcrumb + cabeçalho */}
      <header>
        <nav className="mb-1 flex items-center gap-1.5 text-xs text-neutral-400">
          <Link href="/" className="hover:text-neutral-600">Dashboard</Link>
          <span>/</span>
          <Link href="/clientes" className="hover:text-neutral-600">Clientes</Link>
          <span>/</span>
          <Link href={`/clientes/${clienteId}`} className="hover:text-neutral-600">
            {cliente.nome}
          </Link>
          <span>/</span>
          <span className="text-neutral-700">Performance</span>
        </nav>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{cliente.nome}</h1>
            {cliente.empresa && (
              <p className="text-sm text-neutral-500">{cliente.empresa}</p>
            )}
            <p className="mt-0.5 text-xs text-neutral-400">
              Performance — {formatDateBR(from)} a {formatDateBR(to)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <DateFilter from={from} to={to} basePath={`/clientes/${clienteId}/performance`} />
            <GerarRelatorioButton
              clienteId={clienteId}
              meses={listarMesesRecentes(12).filter((m) => m.value !== mesAtualEmCurso())}
              defaultMesAno={listarMesesRecentes(2).filter((m) => m.value !== mesAtualEmCurso())[0]?.value ?? ""}
            />
            <Link
              href={`/clientes/${clienteId}`}
              className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              ⚙ Gerenciar contas
            </Link>
          </div>
        </div>
      </header>

      {/* ── Funil CRM ──────────────────────────────────────────────────── */}
      {temCrm && crmFunil && (
        <section>
          <SectionHeader color="bg-violet-500" title="Funil CRM" sub="Leads criados no período (via webhook)" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <KpiCard
              label="Total de leads"
              value={formatInt(crmFunil.totalLeads)}
              tone={crmFunil.totalLeads > 0 ? "ok" : "default"}
              highlight={crmFunil.totalLeads > 0}
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
                  value={formatInt(p.qtd)}
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
          ) : crmFunil.totalLeads > 0 && (
            <p className="mt-3 text-xs text-neutral-400">
              💡 Nenhum lead deste período possui atribuição de anúncio — os leads podem ter vindo de tráfego orgânico, Google Ads ou formulários compartilhados sem rastreamento Meta ativo.
            </p>
          )}
        </section>
      )}

      {/* ── Meta Ads ───────────────────────────────────────────────────── */}
      {contasMeta.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />
              <h2 className="text-sm font-semibold text-neutral-700">Meta Ads</h2>
              <span className="text-xs text-neutral-400">
                {contasMeta.length} conta{contasMeta.length > 1 ? "s" : ""}
              </span>
            </div>
            {campanhasMeta.length > 0 && (
              <div className="flex items-center gap-4 text-xs text-neutral-500">
                <span>Gasto: <strong className="text-neutral-900">{formatBRL(metaTotal.spend)}</strong></span>
                <span>Cliques: <strong className="text-neutral-900">{formatInt(metaTotal.cliques)}</strong></span>
                <span>Impressões: <strong className="text-neutral-900">{formatInt(metaTotal.impressoes)}</strong></span>
              </div>
            )}
          </div>

          <MetaHierarquia
            campanhas={campanhasMeta}
            adsets={adsetsMeta}
            ads={adsMeta}
            leadsMap={leadsMap}
            temCrm={temCrm}
            totalLeadsCampanha={totalLeadsCampanha}
          />
        </section>
      )}

      {/* ── Google Ads ─────────────────────────────────────────────────── */}
      {contasGoogle.length > 0 && (
        <section>
          <SectionHeader
            color="bg-green-500"
            title="Google Ads"
            sub={`${contasGoogle.length} conta${contasGoogle.length > 1 ? "s" : ""}`}
          />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            <KpiCard label="Gasto total"  value={formatBRL(googleTotal.spend)} />
            <KpiCard label="Impressões"   value={formatInt(googleTotal.impressoes)} />
            <KpiCard label="Cliques"      value={formatInt(googleTotal.cliques)} />
            <KpiCard label="CTR"          value={formatPct(googleCtr)} />
            <KpiCard label="CPC médio"    value={googleTotal.cliques > 0 ? formatBRL(googleCpc) : "—"} />
            <KpiCard label="Conversões"   value={formatInt(googleTotal.conversoes)} />
            <KpiCard label="Taxa de Conv." value={formatPct(googleTaxaConv)} tone={googleTaxaConv > 0 ? "ok" : "default"} highlight />
            <KpiCard label="Custo/Conv."  value={googleCustoConv > 0 ? formatBRL(googleCustoConv) : "—"} />
          </div>

          {contasGoogle.length > 1 && (
            <div className="mt-4 overflow-x-auto rounded-xl border border-neutral-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
                  <tr>
                    <th className="px-4 py-3">Conta</th>
                    <th className="px-4 py-3 text-right">Gasto</th>
                    <th className="px-4 py-3 text-right">Cliques</th>
                    <th className="px-4 py-3 text-right">CTR</th>
                    <th className="px-4 py-3 text-right">CPC</th>
                    <th className="px-4 py-3 text-right">Conv.</th>
                    <th className="px-4 py-3 text-right">Taxa Conv.</th>
                    <th className="px-4 py-3 text-right">Custo/Conv.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {googleResultsBrutos.map((r) => (
                    <tr key={r.customerId} className="hover:bg-neutral-50">
                      <td className="px-4 py-3 font-medium text-neutral-900">
                        {r.contaNome}
                        <p className="text-[10px] text-neutral-400">{r.customerId}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-neutral-900">{formatBRL(r.spend)}</td>
                      <td className="px-4 py-3 text-right text-neutral-600">{formatInt(r.cliques)}</td>
                      <td className="px-4 py-3 text-right text-neutral-600">{formatPct(r.ctr)}</td>
                      <td className="px-4 py-3 text-right text-neutral-600">{r.cliques > 0 ? formatBRL(r.cpc) : "—"}</td>
                      <td className="px-4 py-3 text-right font-medium text-neutral-900">{formatInt(r.conversoes)}</td>
                      <td className={`px-4 py-3 text-right font-medium ${r.taxaConversao > 0 ? "text-emerald-700" : "text-neutral-400"}`}>
                        {formatPct(r.taxaConversao)}
                      </td>
                      <td className="px-4 py-3 text-right text-neutral-600">
                        {r.conversoes > 0 ? formatBRL(round2(r.spend / r.conversoes)) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Sem contas */}
      {contasMeta.length === 0 && contasGoogle.length === 0 && (
        <div className="rounded-xl border border-neutral-200 bg-white px-6 py-12 text-center text-sm text-neutral-500">
          Nenhuma conta de anúncio configurada para este cliente.{" "}
          <Link href={`/clientes/${clienteId}/contas/novo`} className="font-medium text-neutral-700 underline">
            Adicionar conta
          </Link>
        </div>
      )}

      {/* Sem CRM */}
      {!temCrm && (contasMeta.length > 0 || contasGoogle.length > 0) && (
        <p className="text-xs text-neutral-400">
          💡 Para ver o funil CRM nesta página, configure a{" "}
          <Link href={`/clientes/${clienteId}/editar`} className="underline hover:text-neutral-600">
            chave n8n do cliente
          </Link>
          .
        </p>
      )}
    </div>
  );
}

// ─── Componentes locais ───────────────────────────────────────────────────────

function SectionHeader({
  color, title, sub,
}: { color: string; title: string; sub: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />
      <h2 className="text-sm font-semibold text-neutral-700">{title}</h2>
      <span className="text-xs text-neutral-400">{sub}</span>
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
  return (
    <div className={`rounded-xl border p-4 ${highlight ? "border-emerald-200 bg-emerald-50/50" : "border-neutral-200 bg-white"}`}>
      <p className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${tone === "ok" ? "text-emerald-700" : "text-neutral-900"}`}>
        {value}
      </p>
    </div>
  );
}
