// Página de overview de todos os clientes de Panfletagem Digital.
// Exibe métricas agregadas por cliente no período selecionado.

import Link from "next/link";
import { db } from "@/lib/db";
import { defaultRange } from "@/lib/performance";
import { getPanfletagemInsights, type PanfletagemInsightsDB } from "@/lib/db-insights";
import { DateFilter } from "@/app/(app)/_date-filter";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function fInt(v: number): string {
  return new Intl.NumberFormat("pt-BR").format(Math.round(v));
}

function formatDateBR(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function isValidIso(s: string | undefined): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

type Props = {
  searchParams: Promise<{ from?: string; to?: string }>;
};

type ClienteComMetricas = {
  id: number;
  nome: string;
  empresa: string | null;
  dados: PanfletagemInsightsDB | null;
};

export default async function PanfletagemOverviewPage({ searchParams }: Props) {
  const sp = await searchParams;
  const def = defaultRange();
  const from = isValidIso(sp.from) ? sp.from : def.from;
  const to   = isValidIso(sp.to)   ? sp.to   : def.to;

  const clientes = await db.cliente.findMany({
    where: { ativo: true, tipoServico: "panfletagem_digital" },
    select: {
      id: true,
      nome: true,
      empresa: true,
      n8nClientKey: true,
    },
    orderBy: { nome: "asc" },
  });

  // Busca métricas de todos em paralelo
  const resultados: ClienteComMetricas[] = await Promise.all(
    clientes.map(async (c) => ({
      id: c.id,
      nome: c.nome,
      empresa: c.empresa,
      dados: c.n8nClientKey
        ? await getPanfletagemInsights(c.n8nClientKey, from, to)
        : null,
    })),
  );

  // Totalizadores
  const totalImpressions = resultados.reduce((s, r) => s + (r.dados?.impressoes ?? 0), 0);
  const totalAlcance     = resultados.reduce((s, r) => s + (r.dados?.alcance ?? 0), 0);
  const totalVisitas     = resultados.reduce((s, r) => s + (r.dados?.visitasPerfil ?? 0), 0);
  const totalConversas   = resultados.reduce((s, r) => s + (r.dados?.conversas ?? 0), 0);

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Panfletagem Digital</h1>
          <p className="text-sm text-neutral-500">
            {clientes.length} {clientes.length === 1 ? "cliente" : "clientes"} · {formatDateBR(from)} a {formatDateBR(to)}
          </p>
        </div>
        <DateFilter from={from} to={to} basePath="/panfletagem" />
      </header>

      {/* KPI cards de totais */}
      {clientes.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard label="Visualizações" value={fInt(totalImpressions)} cor="blue" />
          <KpiCard label="Alcance"        value={fInt(totalAlcance)}     cor="indigo" />
          <KpiCard label="Visitas ao Perfil" value={fInt(totalVisitas)}  cor="violet" />
          <KpiCard label="Conversas WhatsApp" value={fInt(totalConversas)} cor="green" />
        </div>
      )}

      {/* Tabela por cliente */}
      <section>
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3 text-right">Visualizações</th>
                <th className="px-4 py-3 text-right">Alcance</th>
                <th className="px-4 py-3 text-right">Visitas Perfil</th>
                <th className="px-4 py-3 text-right">Conversas</th>
                <th className="px-4 py-3 text-right">Anúncios</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {resultados.map((r) => (
                <tr key={r.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/clientes/${r.id}/panfletagem`}
                      className="font-medium text-neutral-900 hover:underline"
                    >
                      {r.nome}
                    </Link>
                    {r.empresa && (
                      <p className="text-xs text-neutral-500">{r.empresa}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-blue-700">
                    {r.dados ? fInt(r.dados.impressoes) : <span className="text-neutral-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-700">
                    {r.dados ? fInt(r.dados.alcance) : <span className="text-neutral-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-violet-700">
                    {r.dados && r.dados.visitasPerfil > 0
                      ? fInt(r.dados.visitasPerfil)
                      : <span className="text-neutral-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-green-700">
                    {r.dados && r.dados.conversas > 0
                      ? fInt(r.dados.conversas)
                      : <span className="text-neutral-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-500">
                    {r.dados ? r.dados.ads.length : <span className="text-neutral-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/clientes/${r.id}/panfletagem`}
                      className="text-xs font-medium text-neutral-700 hover:underline"
                    >
                      ver detalhes →
                    </Link>
                  </td>
                </tr>
              ))}
              {resultados.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-sm text-neutral-500"
                  >
                    Nenhum cliente de Panfletagem Digital cadastrado.{" "}
                    <Link
                      href="/clientes/novo"
                      className="font-medium text-neutral-700 underline"
                    >
                      Criar cliente
                    </Link>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

const corMap = {
  blue:   "border-blue-200 bg-blue-50/40 text-blue-800",
  indigo: "border-indigo-200 bg-indigo-50/40 text-indigo-800",
  violet: "border-violet-200 bg-violet-50/40 text-violet-800",
  green:  "border-green-200 bg-green-50/40 text-green-800",
};

function KpiCard({
  label, value, cor,
}: {
  label: string;
  value: string;
  cor: keyof typeof corMap;
}) {
  return (
    <div className={`rounded-xl border p-4 ${corMap[cor]}`}>
      <p className="text-[10px] uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}
