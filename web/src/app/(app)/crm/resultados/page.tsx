import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ClienteSeletor } from "@/components/crm/cliente-seletor";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ cliente?: string }> };

type LeadResultado = {
  lead_id: string;
  lead_nome: string | null;
  lead_whatsapp: string | null;
  fase: string | null;
  total_negociado: number;
  ultima_negociacao: Date | null;
};

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

  const rows: LeadResultado[] = cliente?.n8nClientKey
    ? await db.$queryRaw<LeadResultado[]>`
        SELECT
          fl.lead_id,
          fl.lead_nome,
          fl.lead_whatsapp,
          fl.fase,
          COALESCE(SUM(hn.valor), 0)::float AS total_negociado,
          MAX(hn.registrado_em)             AS ultima_negociacao
        FROM fb_leads fl
        LEFT JOIN crm_historico_negociacao hn
          ON hn.lead_id = fl.lead_id
         AND lower(hn.client_key) = lower(${cliente.n8nClientKey})
        WHERE lower(fl.client_key) = lower(${cliente.n8nClientKey})
        GROUP BY fl.lead_id, fl.lead_nome, fl.lead_whatsapp, fl.fase
        HAVING COALESCE(SUM(hn.valor), 0) > 0
        ORDER BY total_negociado DESC
      `
    : [];

  const totalCliente = rows.reduce((s, r) => s + r.total_negociado, 0);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const fmtDate = (d: Date | null) =>
    d ? d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
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

      {totalCliente > 0 && (
        <div className="mb-6 rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 flex items-center justify-between">
          <p className="text-sm font-medium text-emerald-700">Total geral do cliente</p>
          <span className="text-2xl font-bold text-emerald-700">{fmt(totalCliente)}</span>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-neutral-400">Nenhum valor de negociação registrado.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">
                <th className="px-4 py-3">Lead</th>
                <th className="px-4 py-3">WhatsApp</th>
                <th className="px-4 py-3">Etapa</th>
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
