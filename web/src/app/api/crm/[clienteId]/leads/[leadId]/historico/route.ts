import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { clienteId: string; leadId: string };

type HistoricoRow = {
  id: bigint;
  etapa: string;
  tipo: string;
  origem: string | null;
  ad_id: string | null;
  ctwa_clid: string | null;
  fase_anterior: string | null;
  entrou_em: Date;
  saiu_em: Date | null;
};

type LeadRow = {
  data_criacao: string | null;
  ad_id: string | null;
  ctwa_clid: string | null;
  source_app: string | null;
  ad_name: string | null;
  adset_name: string | null;
  campaign_name: string | null;
  ad_title: string | null;
  gclid: string | null;
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { clienteId, leadId } = await params;
  const id = parseInt(clienteId, 10);
  if (isNaN(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const clienteRows = await db.$queryRaw<{ n8n_client_key: string }[]>`
    SELECT n8n_client_key FROM clientes WHERE id = ${id} LIMIT 1
  `;
  if (!clienteRows[0]?.n8n_client_key) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }
  const clientKey = clienteRows[0].n8n_client_key;

  const [historico, leadRows] = await Promise.all([
    db.$queryRaw<HistoricoRow[]>`
      SELECT id, etapa, tipo, origem, ad_id, ctwa_clid, fase_anterior, entrou_em, saiu_em
      FROM crm_historico_etapas
      WHERE lead_id = ${leadId}
        AND lower(client_key) = lower(${clientKey})
      ORDER BY entrou_em ASC
    `,
    db.$queryRaw<LeadRow[]>`
      SELECT data_criacao, ad_id, ctwa_clid, source_app,
             ad_name, adset_name, campaign_name, ad_title, gclid
      FROM fb_leads
      WHERE lead_id = ${leadId}
        AND lower(client_key) = lower(${clientKey})
      LIMIT 1
    `,
  ]);

  const lead = leadRows[0] ?? null;

  const eventos = historico.map((h) => ({
    id:            h.id.toString(),
    etapa:         h.etapa,
    tipo:          h.tipo,
    origem:        h.origem,
    ad_id:         h.ad_id,
    ctwa_clid:     h.ctwa_clid,
    fase_anterior: h.fase_anterior,
    entrou_em:     h.entrou_em.toISOString(),
    saiu_em:       h.saiu_em?.toISOString() ?? null,
  }));

  // Se não há histórico registrado ainda (leads anteriores à migration),
  // monta um evento sintético de "entrada" a partir dos dados do fb_leads
  if (eventos.length === 0 && lead) {
    let origemLabel = "Orgânico";
    if (lead.gclid)              origemLabel = "Google Ads";
    else if (lead.ad_id || lead.ctwa_clid) origemLabel = "Meta Ads";

    eventos.push({
      id:            "synthetic-0",
      etapa:         "Novo Lead",
      tipo:          "entrada",
      origem:        origemLabel,
      ad_id:         lead.ad_id,
      ctwa_clid:     lead.ctwa_clid,
      fase_anterior: null,
      entrou_em:     lead.data_criacao
        ? new Date(lead.data_criacao).toISOString()
        : new Date().toISOString(),
      saiu_em: null,
    });
  }

  return NextResponse.json({
    eventos,
    lead: lead
      ? {
          ad_name:       lead.ad_name,
          adset_name:    lead.adset_name,
          campaign_name: lead.campaign_name,
          ad_title:      lead.ad_title,
          source_app:    lead.source_app,
        }
      : null,
  });
}
