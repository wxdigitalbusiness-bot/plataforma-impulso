// Lógica de upsert de lead no CRM.
// Dado um telefone + client_key (e opcionalmente dados de atribuição CTWA),
// cria o lead em fb_leads se não existir ou atualiza ctwa_clid/ad_id se vieram
// num webhook mais recente.

import { db } from "@/lib/db";

export type LeadUpsertInput = {
  phone: string;         // somente dígitos, ex: "556384823503"
  clientKey: string;
  clientName: string;    // nome do cliente (coluna client_name NOT NULL na tabela)
  pushName: string | null;
  adId: string | null;
  ctwaClid: string | null;
  sourceApp: string | null;
  recebidaEm: Date;
};

export type LeadUpsertResult = {
  leadId: string;   // phone usado como lead_id
  isNew: boolean;
};

export async function upsertCrmLead(input: LeadUpsertInput): Promise<LeadUpsertResult> {
  const { phone, clientKey, clientName, pushName, adId, ctwaClid, sourceApp, recebidaEm } = input;

  // Usa o telefone como lead_id (padrão já adotado nos workflows n8n)
  const leadId = phone;

  await db.$executeRaw`
    INSERT INTO fb_leads (
      lead_id, client_key, client_name, lead_nome, lead_whatsapp,
      ad_id, ctwa_clid, source_app,
      data_criacao, fase
    ) VALUES (
      ${leadId},
      ${clientKey},
      ${clientName},
      ${pushName ?? ""},
      ${phone},
      ${adId},
      ${ctwaClid},
      ${sourceApp},
      ${recebidaEm.toISOString().split("T")[0]},
      'Novo Lead'
    )
    ON CONFLICT (lead_id) DO UPDATE SET
      -- Atualiza nome se estava vazio
      lead_nome    = CASE
        WHEN TRIM(COALESCE(fb_leads.lead_nome, '')) = '' AND ${pushName} IS NOT NULL
        THEN ${pushName}
        ELSE fb_leads.lead_nome
      END,
      -- Atualiza atribuição CTWA só se ainda não tinha (preserva o primeiro clique)
      ctwa_clid    = COALESCE(fb_leads.ctwa_clid,  ${ctwaClid}),
      ad_id        = COALESCE(fb_leads.ad_id,       ${adId}),
      source_app   = COALESCE(fb_leads.source_app,  ${sourceApp})
  `;

  // Verifica se já existia antes do upsert para retornar isNew correto
  const existing = await db.$queryRaw<Array<{ fase: string }>>`
    SELECT fase FROM fb_leads
    WHERE lead_id = ${leadId}
      AND lower(client_key) = lower(${clientKey})
    LIMIT 1
  `;

  return {
    leadId,
    isNew: existing.length === 0 || existing[0].fase === "Novo Lead",
  };
}
