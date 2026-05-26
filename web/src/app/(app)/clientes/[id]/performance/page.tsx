// Página de detalhe de performance por cliente.
// Meta Ads: tabela por campanha com objetivo + destino de conversão + métricas.
// Google Ads: KPIs agregados com taxa de conversão + breakdown por conta (se múltiplas).

import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  getInsightsCampanhasMeta,
  type CampanhaMetrics,
} from "@/lib/meta-api";
import { getInsightsGoogle } from "@/lib/google-ads-api";
import { defaultRange } from "@/lib/performance";

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

type Props = { params: Promise<{ id: string }> };

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PerformancePage({ params }: Props) {
  const { id } = await params;
  const clienteId = Number(id);
  if (Number.isNaN(clienteId)) notFound();

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
          googleAdsMccId: true,
        },
        orderBy: { nome: "asc" },
      },
    },
  });
  if (!cliente) notFound();

  const { from, to } = defaultRange();

  const contasMeta = cliente.contas.filter((c) => c.metaAdAccountId);
  const contasGoogle = cliente.contas.filter((c) => c.googleAdCustomerId);

  // Busca em paralelo: campanhas Meta + insights Google por conta
  const [campanhasMetaBruta, googleResultsBrutos] = await Promise.all([
    Promise.all(
      contasMeta.map((c) =>
        getInsightsCampanhasMeta(c.metaAdAccountId!, from, to).then(
          (campanhas) =>
            campanhas.map((camp) => ({
              ...camp,
              contaId: c.id,
              contaNome: c.nome,
            })),
        ),
      ),
    ).then((arr) => arr.flat()),

    Promise.all(
      contasGoogle.map(async (c): Promise<GoogleContaResult> => {
        const r = await getInsightsGoogle(c.googleAdCustomerId!, c.googleAdsMccId, from, to);
        return {
          contaId: c.id,
          contaNome: c.nome,
          customerId: c.googleAdCustomerId!,
          spend: r.spend,
          impressoes: r.impressoes,
          cliques: r.cliques,
          ctr: r.ctr,
          cpc: r.cpc,
          conversoes: r.conversoes,
          taxaConversao:
            r.cliques > 0
              ? round2((r.conversoes / r.cliques) * 100)
              : 0,
          erro: r.erro,
        };
      }),
    ),
  ]);

  // Ordena campanhas Meta por spend desc
  const campanhasMeta = campanhasMetaBruta.sort(
    (a, b) => b.spend - a.spend,
  );

  // Totais Google
  const googleTotal = googleResultsBrutos.reduce(
    (acc, r) => {
      if (!r.erro) {
        acc.spend += r.spend;
        acc.impressoes += r.impressoes;
        acc.cliques += r.cliques;
        acc.conversoes += r.conversoes;
      }
      return acc;
    },
    { spend: 0, impressoes: 0, cliques: 0, conversoes: 0 },
  );
  const googleCtr =
    googleTotal.impressoes > 0
      ? round2((googleTotal.cliques / googleTotal.impressoes) * 100)
      : 0;
  const googleCpc =
    googleTotal.cliques > 0
      ? round2(googleTotal.spend / googleTotal.cliques)
      : 0;
  const googleTaxaConversao =
    googleTotal.cliques > 0
      ? round2((googleTotal.conversoes / googleTotal.cliques) * 100)
      : 0;

  return (
    <div className="space-y-8">
      {/* Breadcrumb + cabeçalho */}
      <header>
        <nav className="mb-1 flex items-center gap-1.5 text-xs text-neutral-400">
          <Link href="/" className="hover:text-neutral-600">
            Dashboard
          </Link>
          <span>/</span>
          <Link href="/clientes" className="hover:text-neutral-600">
            Clientes
          </Link>
          <span>/</span>
          <Link
            href={`/clientes/${clienteId}`}
            className="hover:text-neutral-600"
          >
            {cliente.nome}
          </Link>
          <span>/</span>
          <span className="text-neutral-700">Performance</span>
        </nav>
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {cliente.nome}
            </h1>
            {cliente.empresa && (
              <p className="text-sm text-neutral-500">{cliente.empresa}</p>
            )}
            <p className="mt-0.5 text-xs text-neutral-400">
              Performance — últimos 3 dias
            </p>
          </div>
          <Link
            href={`/clientes/${clienteId}`}
            className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            ⚙ Gerenciar contas
          </Link>
        </div>
      </header>

      {/* ── Meta Ads ──────────────────────────────────────────────── */}
      {contasMeta.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />
            <h2 className="text-sm font-semibold text-neutral-700">
              Meta Ads
            </h2>
            <span className="text-xs text-neutral-400">
              {contasMeta.length} conta{contasMeta.length > 1 ? "s" : ""}
            </span>
          </div>

          {campanhasMeta.length === 0 ? (
            <p className="rounded-xl border border-neutral-200 bg-white px-6 py-8 text-center text-sm text-neutral-500">
              Nenhuma campanha ativa ou pausada com dados no período.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
                  <tr>
                    <th className="px-4 py-3">Campanha</th>
                    <th className="px-4 py-3">Objetivo</th>
                    <th className="px-4 py-3">Destino</th>
                    <th className="px-4 py-3 text-right">Spend</th>
                    <th className="px-4 py-3 text-right">Impressões</th>
                    <th className="px-4 py-3 text-right">Cliques</th>
                    <th className="px-4 py-3 text-right">CTR</th>
                    <th className="px-4 py-3 text-right">CPC</th>
                    <th className="px-4 py-3 text-right">Conv.</th>
                    <th className="px-4 py-3 text-right">Taxa Conv.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {campanhasMeta.map((camp) => (
                    <tr
                      key={camp.campanhaId}
                      className="hover:bg-neutral-50"
                    >
                      <td className="max-w-[220px] px-4 py-3">
                        <p
                          className="truncate font-medium text-neutral-900"
                          title={camp.nome}
                        >
                          {camp.nome}
                        </p>
                        {contasMeta.length > 1 && (
                          <p className="text-[10px] text-neutral-400">
                            {camp.contaNome}
                          </p>
                        )}
                        {camp.status === "PAUSED" && (
                          <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">
                            pausada
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <ObjetivoTag objetivo={camp.objetivo} />
                      </td>
                      <td className="px-4 py-3 text-xs text-neutral-600">
                        {camp.destinoConversao ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-neutral-900">
                        {formatBRL(camp.spend)}
                      </td>
                      <td className="px-4 py-3 text-right text-neutral-600">
                        {formatInt(camp.impressoes)}
                      </td>
                      <td className="px-4 py-3 text-right text-neutral-600">
                        {formatInt(camp.cliques)}
                      </td>
                      <td className="px-4 py-3 text-right text-neutral-600">
                        {formatPct(camp.ctr)}
                      </td>
                      <td className="px-4 py-3 text-right text-neutral-600">
                        {camp.cliques > 0 ? formatBRL(camp.cpc) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-neutral-900">
                        {formatInt(camp.conversoes)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-medium ${
                          camp.taxaConversao > 0
                            ? "text-emerald-700"
                            : "text-neutral-400"
                        }`}
                      >
                        {formatPct(camp.taxaConversao)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ── Google Ads ────────────────────────────────────────────── */}
      {contasGoogle.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
            <h2 className="text-sm font-semibold text-neutral-700">
              Google Ads
            </h2>
            <span className="text-xs text-neutral-400">
              {contasGoogle.length} conta{contasGoogle.length > 1 ? "s" : ""}
            </span>
          </div>

          {/* KPIs do total Google */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            <KpiCard label="Gasto total" value={formatBRL(googleTotal.spend)} />
            <KpiCard
              label="Impressões"
              value={formatInt(googleTotal.impressoes)}
            />
            <KpiCard label="Cliques" value={formatInt(googleTotal.cliques)} />
            <KpiCard label="CTR" value={formatPct(googleCtr)} />
            <KpiCard
              label="CPC médio"
              value={googleTotal.cliques > 0 ? formatBRL(googleCpc) : "—"}
            />
            <KpiCard
              label="Conversões"
              value={formatInt(googleTotal.conversoes)}
            />
            <KpiCard
              label="Taxa de Conv."
              value={formatPct(googleTaxaConversao)}
              tone={googleTaxaConversao > 0 ? "ok" : "default"}
              highlight
            />
          </div>

          {/* Breakdown por conta (só quando há mais de uma) */}
          {contasGoogle.length > 1 && (
            <div className="mt-4 overflow-x-auto rounded-xl border border-neutral-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
                  <tr>
                    <th className="px-4 py-3">Conta</th>
                    <th className="px-4 py-3 text-right">Spend</th>
                    <th className="px-4 py-3 text-right">Impressões</th>
                    <th className="px-4 py-3 text-right">Cliques</th>
                    <th className="px-4 py-3 text-right">CTR</th>
                    <th className="px-4 py-3 text-right">CPC</th>
                    <th className="px-4 py-3 text-right">Conv.</th>
                    <th className="px-4 py-3 text-right">Taxa Conv.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {googleResultsBrutos.map((r) => (
                    <tr key={r.customerId} className="hover:bg-neutral-50">
                      <td className="px-4 py-3 font-medium text-neutral-900">
                        {r.contaNome}
                        <p className="text-[10px] text-neutral-400">
                          {r.customerId}
                        </p>
                      </td>
                      {r.erro ? (
                        <td
                          colSpan={7}
                          className="px-4 py-3 text-xs text-red-600"
                        >
                          ⚠ {r.erro}
                        </td>
                      ) : (
                        <>
                          <td className="px-4 py-3 text-right font-medium text-neutral-900">
                            {formatBRL(r.spend)}
                          </td>
                          <td className="px-4 py-3 text-right text-neutral-600">
                            {formatInt(r.impressoes)}
                          </td>
                          <td className="px-4 py-3 text-right text-neutral-600">
                            {formatInt(r.cliques)}
                          </td>
                          <td className="px-4 py-3 text-right text-neutral-600">
                            {formatPct(r.ctr)}
                          </td>
                          <td className="px-4 py-3 text-right text-neutral-600">
                            {r.cliques > 0 ? formatBRL(r.cpc) : "—"}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-neutral-900">
                            {formatInt(r.conversoes)}
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-medium ${
                              r.taxaConversao > 0
                                ? "text-emerald-700"
                                : "text-neutral-400"
                            }`}
                          >
                            {formatPct(r.taxaConversao)}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Sem contas configuradas */}
      {contasMeta.length === 0 && contasGoogle.length === 0 && (
        <div className="rounded-xl border border-neutral-200 bg-white px-6 py-12 text-center text-sm text-neutral-500">
          Nenhuma conta de anúncio configurada para este cliente.{" "}
          <Link
            href={`/clientes/${clienteId}/contas/novo`}
            className="font-medium text-neutral-700 underline"
          >
            Adicionar conta
          </Link>
        </div>
      )}
    </div>
  );
}

// ─── Componentes locais ───────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  tone = "default",
  highlight = false,
}: {
  label: string;
  value: string;
  tone?: "default" | "ok";
  highlight?: boolean;
}) {
  const valueClass =
    tone === "ok"
      ? "text-emerald-700"
      : highlight
        ? "text-neutral-900"
        : "text-neutral-900";

  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight
          ? "border-emerald-200 bg-emerald-50/50"
          : "border-neutral-200 bg-white"
      }`}
    >
      <p className="text-[10px] uppercase tracking-wide text-neutral-500">
        {label}
      </p>
      <p className={`mt-1 text-xl font-semibold ${valueClass}`}>{value}</p>
    </div>
  );
}

const OBJETIVO_COR: Record<string, string> = {
  Vendas: "bg-emerald-50 text-emerald-700",
  "Geração de leads": "bg-violet-50 text-violet-700",
  Tráfego: "bg-blue-50 text-blue-700",
  Reconhecimento: "bg-sky-50 text-sky-700",
  Engajamento: "bg-orange-50 text-orange-700",
  "Promoção de app": "bg-pink-50 text-pink-700",
  Conversões: "bg-emerald-50 text-emerald-700",
  Mensagens: "bg-teal-50 text-teal-700",
};

function ObjetivoTag({ objetivo }: { objetivo: string }) {
  const cor =
    OBJETIVO_COR[objetivo] ?? "bg-neutral-100 text-neutral-600";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cor}`}>
      {objetivo}
    </span>
  );
}
