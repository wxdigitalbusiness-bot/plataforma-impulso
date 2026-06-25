import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { KanbanBoard } from "@/components/crm/kanban-board";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

type LeadRow = {
  lead_id: string;
  lead_nome: string;
  lead_whatsapp: string;
  fase: string;
  source_app: string | null;
  ad_id: string | null;
  ctwa_clid: string | null;
  gclid: string | null;
  utm_source: string | null;
  webhook_origem: string | null;
  data_criacao: Date;
  primeira_msg_em: Date | null;
  ultima_msg: string | null;
  ultima_msg_tipo: string | null;
  ultima_msg_em: Date | null;
};

export default async function CrmPage({ params }: Props) {
  const { id } = await params;
  const clienteId = Number(id);
  if (Number.isNaN(clienteId)) notFound();

  const cliente = await db.cliente.findUnique({
    where: { id: clienteId },
    select: {
      id: true,
      nome: true,
      n8nClientKey: true,
      evolutionInstance: true,
      crmWebhooks: {
        select: { etapa: true, etapaLabel: true, ehExtra: true },
        orderBy: [{ ehExtra: "asc" }, { criadoEm: "asc" }],
      },
    },
  });

  if (!cliente) notFound();

  const etapas = cliente.crmWebhooks.map((w) => ({
    etapa: w.etapa,
    etapaLabel: w.etapaLabel,
  }));

  // Leads iniciais (serão atualizados pelo polling do KanbanBoard)
  const leadsRaw: LeadRow[] = cliente.n8nClientKey
    ? await db.$queryRaw<LeadRow[]>`
        SELECT
          fl.lead_id,
          fl.lead_nome,
          fl.lead_whatsapp,
          fl.fase,
          fl.source_app,
          fl.ad_id,
          fl.ctwa_clid,
          fl.gclid,
          fl.utm_source,
          fl.webhook_origem,
          fl.data_criacao,
          fm.recebida_em AS primeira_msg_em,
          m.conteudo     AS ultima_msg,
          m.tipo         AS ultima_msg_tipo,
          m.recebida_em  AS ultima_msg_em
        FROM fb_leads fl
        LEFT JOIN LATERAL (
          SELECT recebida_em
          FROM crm_mensagens
          WHERE lead_id = fl.lead_id
            AND client_key = fl.client_key
          ORDER BY recebida_em ASC
          LIMIT 1
        ) fm ON TRUE
        LEFT JOIN LATERAL (
          SELECT conteudo, tipo, recebida_em
          FROM crm_mensagens
          WHERE lead_id = fl.lead_id
            AND client_key = fl.client_key
          ORDER BY recebida_em DESC
          LIMIT 1
        ) m ON TRUE
        WHERE lower(fl.client_key) = lower(${cliente.n8nClientKey})
        ORDER BY COALESCE(m.recebida_em, fl.data_criacao::timestamptz) DESC
      `
    : [];

  // Serializa datas para passar ao componente cliente
  const leads = leadsRaw.map((l) => ({
    ...l,
    data_criacao: l.data_criacao ? new Date(l.data_criacao).toISOString() : null,
    primeira_msg_em: l.primeira_msg_em ? l.primeira_msg_em.toISOString() : null,
    ultima_msg_em: l.ultima_msg_em ? l.ultima_msg_em.toISOString() : null,
  }));

  const semConfiguracao = !cliente.evolutionInstance;
  const semEtapas = etapas.length === 0;

  return (
    <div className="flex h-full flex-col gap-0 overflow-hidden">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-6 py-3">
        <div>
          <Link href={`/clientes/${clienteId}`} className="text-xs text-neutral-500 hover:underline">
            ← {cliente.nome}
          </Link>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight">CRM — {cliente.nome}</h1>
          <p className="text-xs text-neutral-400">
            {leads.length} {leads.length === 1 ? "lead" : "leads"} no funil
          </p>
        </div>
        <Link
          href={`/clientes/${clienteId}/editar`}
          className="rounded-lg border border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
        >
          Configurar CRM
        </Link>
      </header>

      {/* Avisos + Kanban */}
      {semConfiguracao && (
        <div className="mx-6 mt-4 shrink-0 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Instância Evolution não configurada.</strong>{" "}
          <Link href={`/clientes/${clienteId}/editar`} className="underline">Configure agora</Link>{" "}
          para começar a receber leads via WhatsApp.
        </div>
      )}

      {semEtapas && (
        <div className="mx-6 mt-4 shrink-0 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
          Nenhuma etapa CRM configurada.{" "}
          <Link href={`/clientes/${clienteId}/editar`} className="underline">Configure as etapas do funil</Link>{" "}
          para habilitar o Kanban.
        </div>
      )}

      {!semEtapas && (
        <div className="flex-1 overflow-hidden px-6 py-4">
          <KanbanBoard
            clienteId={clienteId}
            etapas={etapas}
            initialLeads={leads}
          />
        </div>
      )}
    </div>
  );
}
