import Link from "next/link";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { sincronizarSaldosTodos } from "@/lib/sync-saldos";
import { obterPerformance, defaultRange } from "@/lib/performance";
import { getCrmFunilDetalhadoMultiplos, type CrmFunilDetalhado } from "@/lib/db-insights";
import { DateFilter } from "./_date-filter";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function tempoRelativo(data: Date | null) {
  if (!data) return null;
  const segundos = Math.round((Date.now() - data.getTime()) / 1000);
  if (segundos < 60) return `há ${segundos}s`;
  const minutos = Math.round(segundos / 60);
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `há ${horas}h`;
  const dias = Math.round(horas / 24);
  return `há ${dias}d`;
}

async function atualizarSaldosAgora() {
  "use server";
  await sincronizarSaldosTodos();
  revalidatePath("/");
}

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

function formatDateBR(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function isValidIso(s?: string): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
}

type Props = { searchParams: Promise<{ from?: string; to?: string }> };

export default async function DashboardPage({ searchParams }: Props) {
  const sp = await searchParams;
  const def = defaultRange();
  const from = isValidIso(sp.from) ? sp.from : def.from;
  const to = isValidIso(sp.to) && sp.to >= from ? sp.to : def.to;
  // Contas ativas (linhas individuais de clientes_ativos)
  const contas = await db.clienteAtivo.findMany({
    where: { ativo: true },
    select: {
      ultimoSaldo: true,
      ultimoTipoConta: true,
      limiteMinimo: true,
      receberAlertaSaldo: true,
      saldoAtualizadoEm: true,
      ultimoSaldoGoogle: true,
      ultimoTipoContaGoogle: true,
      limiteMinimoGoogle: true,
      receberAlertaGoogle: true,
      saldoGoogleAtualizadoEm: true,
    },
  });

  // Clientes ativos (entidade parent — count distinct de cliente, não de conta)
  const totalClientesAtivos = await db.cliente.count({
    where: { ativo: true },
  });

  const totalAlertasMeta = contas.filter((c) => c.receberAlertaSaldo).length;
  const totalAlertasGoogle = contas.filter((c) => c.receberAlertaGoogle).length;

  const totalCriticoMeta = contas.filter((c) => {
    if (c.ultimoTipoConta !== "pre_paga" || c.ultimoSaldo === null) return false;
    return Number(c.ultimoSaldo) < Number(c.limiteMinimo);
  }).length;

  const totalCriticoGoogle = contas.filter((c) => {
    if (c.ultimoTipoContaGoogle !== "pre_paga" || c.ultimoSaldoGoogle === null)
      return false;
    return Number(c.ultimoSaldoGoogle) < Number(c.limiteMinimoGoogle);
  }).length;

  const totalCriticos = totalCriticoMeta + totalCriticoGoogle;

  const ultimaSyncMeta = contas.reduce<Date | null>((acc, c) => {
    if (!c.saldoAtualizadoEm) return acc;
    if (!acc || c.saldoAtualizadoEm > acc) return c.saldoAtualizadoEm;
    return acc;
  }, null);

  const ultimaSyncGoogle = contas.reduce<Date | null>((acc, c) => {
    if (!c.saldoGoogleAtualizadoEm) return acc;
    if (!acc || c.saldoGoogleAtualizadoEm > acc) return c.saldoGoogleAtualizadoEm;
    return acc;
  }, null);

  // Performance dos últimos 7 dias (cache 10min) — chamada paralela com Meta+Google
  const perf = await obterPerformance({ from, to });

  // CRM: buscar funções para todos os clientes que têm n8nClientKey
  const clientesComCrm = await db.cliente.findMany({
    where: { ativo: true, n8nClientKey: { not: null } },
    select: { id: true, n8nClientKey: true },
  });
  const clienteKeyMap = new Map(
    clientesComCrm.map((c) => [c.id, c.n8nClientKey!]),
  );
  const n8nKeys = clientesComCrm.map((c) => c.n8nClientKey!);
  const crmFunilMap: Map<string, CrmFunilDetalhado> = n8nKeys.length > 0
    ? await getCrmFunilDetalhadoMultiplos(n8nKeys, from, to)
    : new Map();

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-neutral-500">
            Resumo geral da agência. Sync automática a cada 1h, 08h–17h BRT, seg–sex.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right text-xs text-neutral-400">
            {ultimaSyncMeta && <p>Meta: última sync {tempoRelativo(ultimaSyncMeta)}</p>}
            {ultimaSyncGoogle && (
              <p>Google: última sync {tempoRelativo(ultimaSyncGoogle)}</p>
            )}
          </div>
          <form action={atualizarSaldosAgora}>
            <button
              type="submit"
              className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              title="Forçar sync agora (Meta + Google)"
            >
              ↻ Atualizar agora
            </button>
          </form>
          <Link
            href="/clientes/novo"
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            + Novo cliente
          </Link>
        </div>
      </header>

      {/* Cards de resumo */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card
          label="Clientes ativos"
          value={String(totalClientesAtivos)}
          href="/clientes"
        />
        <Card label="Alertas Meta" value={String(totalAlertasMeta)} />
        <Card label="Alertas Google" value={String(totalAlertasGoogle)} />
        <Card
          label="Saldos críticos"
          value={String(totalCriticos)}
          tone={totalCriticos > 0 ? "warn" : "ok"}
          href={totalCriticos > 0 ? "/clientes" : undefined}
        />
      </section>

      {/* Performance — últimos 3 dias */}
      <section>
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-neutral-700">
              Performance —{" "}
              <span className="font-normal text-neutral-500">
                {formatDateBR(from)} a {formatDateBR(to)}
              </span>
            </h2>
            <p className="text-xs text-neutral-500">
              Meta + Google agregado por cliente. Atualizado a cada 10 min.
            </p>
          </div>
          <DateFilter from={from} to={to} />
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <KpiCard label="Gasto total" value={formatBRL(perf.totalSpend)} />
          <KpiCard label="Cliques" value={formatInt(perf.totalCliques)} />
          <KpiCard label="CTR médio" value={formatPct(perf.ctrMedio)} />
          <KpiCard
            label="Conversões"
            value={formatInt(perf.totalConversoes)}
            tone={perf.totalConversoes > 0 ? "ok" : "default"}
          />
        </div>

        {/* Tabela por cliente — colunas Meta | Google */}
        <div className="mt-4 overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              {/* Linha 1: grupos de plataforma */}
              <tr className="border-b border-neutral-200">
                <th
                  rowSpan={2}
                  className="border-r border-neutral-200 px-4 py-3 text-left text-xs font-semibold uppercase text-neutral-500 align-bottom"
                >
                  Cliente
                </th>
                <th
                  colSpan={4}
                  className="border-r border-blue-100 bg-blue-50/60 px-4 py-2 text-center text-xs font-semibold text-blue-700"
                >
                  Meta Ads
                </th>
                <th
                  colSpan={5}
                  className="border-r border-green-100 bg-green-50/60 px-4 py-2 text-center text-xs font-semibold text-green-700"
                >
                  Google Ads
                </th>
                <th
                  rowSpan={2}
                  className="bg-violet-50/60 px-4 py-2 text-left text-xs font-semibold text-violet-700 align-bottom"
                >
                  CRM (funil)
                </th>
              </tr>
              {/* Linha 2: sub-colunas */}
              <tr className="border-b border-neutral-200 text-xs uppercase text-neutral-500">
                <th className="bg-blue-50/30 px-4 py-2 text-right">Gasto</th>
                <th className="bg-blue-50/30 px-4 py-2 text-right">Resultado</th>
                <th className="bg-blue-50/30 px-4 py-2 text-right">Custo/Res.</th>
                <th className="border-r border-blue-100 bg-blue-50/30 px-4 py-2 text-right">
                  Frequência
                </th>
                <th className="bg-green-50/30 px-4 py-2 text-right">Gasto</th>
                <th className="bg-green-50/30 px-4 py-2 text-right">Cliques</th>
                <th className="bg-green-50/30 px-4 py-2 text-right">Conv.</th>
                <th className="bg-green-50/30 px-4 py-2 text-right">
                  Taxa Conv.
                </th>
                <th className="border-r border-green-100 bg-green-50/30 px-4 py-2 text-right">
                  Custo/Conv.
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {perf.porCliente
                .filter((c) => c.contasMeta + c.contasGoogle > 0)
                .map((c) => {
                  const clientKey = clienteKeyMap.get(c.clienteId);
                  const crm = clientKey
                    ? crmFunilMap.get(clientKey.toLowerCase())
                    : undefined;
                  return (
                    <tr key={c.clienteId} className="hover:bg-neutral-50">
                      {/* Cliente */}
                      <td className="border-r border-neutral-100 px-4 py-3">
                        <Link
                          href={`/clientes/${c.clienteId}/performance`}
                          className="font-medium text-neutral-900 hover:underline"
                        >
                          {c.nome}
                        </Link>
                        {c.empresa && (
                          <p className="text-xs text-neutral-500">{c.empresa}</p>
                        )}
                        <div className="mt-1 flex items-center gap-1">
                          {c.contasMeta > 0 && (
                            <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">
                              M{c.contasMeta > 1 ? `×${c.contasMeta}` : ""}
                            </span>
                          )}
                          {c.contasGoogle > 0 && (
                            <span className="rounded-full bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-600">
                              G{c.contasGoogle > 1 ? `×${c.contasGoogle}` : ""}
                            </span>
                          )}
                          {clientKey && (
                            <span className="rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-600">
                              CRM
                            </span>
                          )}
                          {c.total.erros.length > 0 && (
                            <span
                              className="text-[10px] text-red-500"
                              title={c.total.erros.join("\n")}
                            >
                              ⚠ {c.total.erros.length} erro(s)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Meta: Gasto / Resultado / Custo/Resultado / Frequência */}
                      {c.contasMeta > 0 ? (
                        <>
                          {/* Gasto */}
                          <td className="px-4 py-3 text-right font-medium text-neutral-900">
                            {formatBRL(c.meta.spend)}
                          </td>
                          {/* Resultado: número + label abaixo */}
                          <td className="px-4 py-3 text-right">
                            <p className="font-medium text-neutral-900">
                              {c.meta.tipoResultado === "Cliques no link"
                                ? formatInt(c.meta.cliques)
                                : formatInt(c.meta.conversoes)}
                            </p>
                            {c.meta.tipoResultado && (
                              <p className="text-[10px] text-neutral-400">
                                {c.meta.tipoResultado}
                              </p>
                            )}
                          </td>
                          {/* Custo por resultado */}
                          <td className="px-4 py-3 text-right text-neutral-600">
                            {(() => {
                              const n =
                                c.meta.tipoResultado === "Cliques no link"
                                  ? c.meta.cliques
                                  : c.meta.conversoes;
                              return n > 0
                                ? formatBRL(c.meta.spend / n)
                                : "—";
                            })()}
                          </td>
                          {/* Frequência */}
                          <td className="border-r border-blue-100 px-4 py-3 text-right text-neutral-600">
                            {c.meta.frequencia > 0
                              ? `${c.meta.frequencia.toFixed(2)}×`
                              : "—"}
                          </td>
                        </>
                      ) : (
                        <td
                          colSpan={4}
                          className="border-r border-blue-100 px-4 py-3 text-center text-xs text-neutral-300"
                        >
                          —
                        </td>
                      )}

                      {/* Google: Spend / Cliques / Conv. / Taxa Conv. / Custo/Conv. */}
                      {c.contasGoogle > 0 ? (
                        <>
                          <td className="px-4 py-3 text-right font-medium text-neutral-900">
                            {formatBRL(c.google.spend)}
                          </td>
                          <td className="px-4 py-3 text-right text-neutral-600">
                            {formatInt(c.google.cliques)}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-neutral-900">
                            {formatInt(c.google.conversoes)}
                          </td>
                          <td className="px-4 py-3 text-right text-neutral-600">
                            {formatPct(c.google.taxaConversao)}
                          </td>
                          <td className="border-r border-green-100 px-4 py-3 text-right text-neutral-600">
                            {c.google.conversoes > 0
                              ? formatBRL(c.google.spend / c.google.conversoes)
                              : "—"}
                          </td>
                        </>
                      ) : (
                        <td
                          colSpan={5}
                          className="border-r border-green-100 px-4 py-3 text-center text-xs text-neutral-300"
                        >
                          —
                        </td>
                      )}

                      {/* CRM: badges dinâmicas por fase */}
                      {crm && crm.totalLeads > 0 ? (
                        <td className="bg-violet-50/20 px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-700">
                            {formatInt(crm.totalLeads)} total
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {crm.porFase.map((p) => (
                              <FaseBadge key={p.fase} fase={p.fase} qtd={p.qtd} />
                            ))}
                          </div>
                        </td>
                      ) : (
                        <td className="bg-violet-50/10 px-4 py-3 text-center text-xs text-neutral-300">
                          —
                        </td>
                      )}
                    </tr>
                  );
                })}
              {perf.porCliente.filter(
                (c) => c.contasMeta + c.contasGoogle > 0,
              ).length === 0 && (
                <tr>
                  <td
                    colSpan={11}
                    className="px-4 py-12 text-center text-sm text-neutral-500"
                  >
                    Nenhum cliente com conta de anúncio configurada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-right text-[10px] text-neutral-400">
          Dados gerados {perf.geradoEm.toLocaleString("pt-BR")}
        </p>
      </section>

      <footer className="text-xs text-neutral-400">
        Sync Meta: workflow [SYNC] no n8n (1h). Sync Google: workflow [SYNC-GOOGLE] no
        n8n (1h, 08-17h BRT). Alertas WhatsApp a cada 2h (08:05–16:05 BRT).
      </footer>
    </div>
  );
}

function FaseBadge({ fase, qtd }: { fase: string; qtd: number }) {
  const l = fase.toLowerCase();
  const cor =
    l.includes("conclu")                  ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
    l.includes("qualif")                  ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
    l.includes("perd")                    ? "bg-red-50 text-red-700 border-red-200"             :
    l === "leads"                         ? "bg-violet-100 text-violet-800 border-violet-300"    :
                                            "bg-neutral-100 text-neutral-700 border-neutral-200";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${cor}`}>
      {fase} <strong className="tabular-nums">{qtd}</strong>
    </span>
  );
}

function KpiCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "ok";
}) {
  const toneClass =
    tone === "ok" ? "text-emerald-700" : "text-neutral-900";
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function Card({
  label,
  value,
  tone = "default",
  href,
}: {
  label: string;
  value: string;
  tone?: "default" | "ok" | "warn";
  href?: string;
}) {
  const toneClass =
    tone === "warn"
      ? "text-red-600"
      : tone === "ok"
        ? "text-emerald-700"
        : "text-neutral-900";

  const inner = (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 transition hover:border-neutral-300">
      <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {inner}
      </Link>
    );
  }
  return inner;
}
