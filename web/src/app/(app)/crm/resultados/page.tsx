import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ClienteSeletor } from "@/components/crm/cliente-seletor";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ cliente?: string; from?: string; to?: string; origem?: string }>;
};

type LeadResultado = {
  lead_id: string;
  lead_nome: string | null;
  lead_whatsapp: string | null;
  fase: string | null;
  eh_pago: boolean;
  total_negociado: number;
  ultima_negociacao: Date | null;
};

type Origem = "todos" | "pago" | "organico";

function isValidIso(s: string | undefined): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export default async function ResultadosPage({ searchParams }: Props) {
  const sp = await searchParams;

  const crmClientes = await db.cliente.findMany({
    where: { ativo: true, crmWebhooks: { some: {} } },
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });

  if (crmClientes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-neutral-400">
        Nenhum cliente com CRM configurado.
      </div>
    );
  }

  const clienteId = Number(sp.cliente);
  const clienteValido = crmClientes.some((c) => c.id === clienteId);

  if (!sp.cliente || !clienteValido) {
    redirect(`/crm/resultados?cliente=${crmClientes[0].id}`);
  }

  const cliente = await db.cliente.findUnique({
    where: { id: clienteId },
    select: { n8nClientKey: true },
  });

  // Período: sem filtro por padrão (mostra o histórico inteiro) — o usuário aplica se quiser
  const from = isValidIso(sp.from) ? sp.from : null;
  const to   = isValidIso(sp.to)   ? sp.to   : null;
  const origem: Origem = sp.origem === "pago" || sp.origem === "organico" ? sp.origem : "todos";

  const rows: LeadResultado[] = cliente?.n8nClientKey
    ? await db.$queryRaw<LeadResultado[]>`
        SELECT
          fl.lead_id,
          fl.lead_nome,
          fl.lead_whatsapp,
          fl.fase,
          (fl.ad_id IS NOT NULL OR fl.ctwa_clid IS NOT NULL OR fl.gclid IS NOT NULL
             OR fl.wbraid IS NOT NULL OR fl.gbraid IS NOT NULL) AS eh_pago,
          COALESCE(SUM(hn.valor), 0)::float AS total_negociado,
          MAX(hn.registrado_em) AS ultima_negociacao
        FROM fb_leads fl
        LEFT JOIN crm_historico_negociacao hn
          ON hn.lead_id = fl.lead_id
         AND lower(hn.client_key) = lower(${cliente.n8nClientKey})
         AND (${from}::date IS NULL OR hn.registrado_em::date >= ${from}::date)
         AND (${to}::date   IS NULL OR hn.registrado_em::date <= ${to}::date)
        WHERE lower(fl.client_key) = lower(${cliente.n8nClientKey})
          AND NOT fl.eh_colaborador
          AND (
            ${origem} = 'todos'
            OR (${origem} = 'pago' AND (fl.ad_id IS NOT NULL OR fl.ctwa_clid IS NOT NULL
                  OR fl.gclid IS NOT NULL OR fl.wbraid IS NOT NULL OR fl.gbraid IS NOT NULL))
            OR (${origem} = 'organico' AND fl.ad_id IS NULL AND fl.ctwa_clid IS NULL
                  AND fl.gclid IS NULL AND fl.wbraid IS NULL AND fl.gbraid IS NULL)
          )
        GROUP BY fl.lead_id, fl.lead_nome, fl.lead_whatsapp, fl.fase, eh_pago
        HAVING COALESCE(SUM(hn.valor), 0) > 0
        ORDER BY total_negociado DESC
      `
    : [];

  const totalGeral   = rows.reduce((s, r) => s + r.total_negociado, 0);
  const totalPago     = rows.filter((r) => r.eh_pago).reduce((s, r) => s + r.total_negociado, 0);
  const totalOrganico = totalGeral - totalPago;

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const fmtDate = (d: Date | null) =>
    d ? d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  const filtroAtivo = from !== null || to !== null || origem !== "todos";

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Resultados</h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            Total negociado por lead — apenas leads com valor registrado.
          </p>
        </div>
        <ClienteSeletor
          clientes={crmClientes}
          clienteAtualId={clienteId}
          basePath="/crm/resultados"
        />
      </div>

      {/* ── Filtros: form GET simples, sem JS — combina cliente+período+origem numa submissão só ── */}
      <form action="/crm/resultados" method="GET" className="mb-6 flex flex-wrap items-end gap-2">
        <input type="hidden" name="cliente" value={clienteId} />

        <div>
          <label className="mb-1 block text-[11px] text-neutral-400">De</label>
          <input
            type="date"
            name="from"
            defaultValue={from ?? ""}
            className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-700 focus:border-neutral-400 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-neutral-400">Até</label>
          <input
            type="date"
            name="to"
            defaultValue={to ?? ""}
            className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-700 focus:border-neutral-400 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-neutral-400">Origem</label>
          <select
            name="origem"
            defaultValue={origem}
            className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-700 focus:border-neutral-400 focus:outline-none"
          >
            <option value="todos">Todos</option>
            <option value="pago">Tráfego pago</option>
            <option value="organico">Orgânico</option>
          </select>
        </div>

        <button
          type="submit"
          className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800"
        >
          Aplicar
        </button>

        {filtroAtivo && (
          <a
            href={`/crm/resultados?cliente=${clienteId}`}
            className="mb-1.5 text-xs text-neutral-400 underline hover:text-neutral-700"
          >
            Limpar filtros
          </a>
        )}
      </form>

      {/* ── Totais ───────────────────────────────────────────────────── */}
      {totalGeral > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-600">Total geral</p>
            <p className="mt-1 text-2xl font-bold text-emerald-700">{fmt(totalGeral)}</p>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-blue-600">Vindo de tráfego pago</p>
            <p className="mt-1 text-2xl font-bold text-blue-700">{fmt(totalPago)}</p>
            <p className="mt-0.5 text-[11px] text-blue-500">
              {totalGeral > 0 ? `${((totalPago / totalGeral) * 100).toFixed(0)}% do total` : "—"}
            </p>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-5 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Orgânico</p>
            <p className="mt-1 text-2xl font-bold text-neutral-700">{fmt(totalOrganico)}</p>
            <p className="mt-0.5 text-[11px] text-neutral-400">
              {totalGeral > 0 ? `${((totalOrganico / totalGeral) * 100).toFixed(0)}% do total` : "—"}
            </p>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-neutral-400">Nenhum valor de negociação registrado no período/filtro selecionado.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">
                <th className="px-4 py-3">Lead</th>
                <th className="px-4 py-3">WhatsApp</th>
                <th className="px-4 py-3">Etapa</th>
                <th className="px-4 py-3">Origem</th>
                <th className="px-4 py-3">Última negociação</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.lead_id} className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50">
                  <td className="px-4 py-3 font-medium text-neutral-800">
                    {r.lead_nome || r.lead_id}
                  </td>
                  <td className="px-4 py-3 text-neutral-500">{r.lead_whatsapp || "—"}</td>
                  <td className="px-4 py-3 text-neutral-500">{r.fase || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      r.eh_pago ? "bg-blue-100 text-blue-700" : "bg-neutral-100 text-neutral-500"
                    }`}>
                      {r.eh_pago ? "Tráfego pago" : "Orgânico"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-500">{fmtDate(r.ultima_negociacao)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                    {fmt(r.total_negociado)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
