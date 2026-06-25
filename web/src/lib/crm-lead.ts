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
      data_criacao, fase, webhook_origem
    ) VALUES (
      ${leadId},
      ${clientKey},
      ${clientName},
      ${pushName ?? ""},
      ${phone},
      ${adId},
      ${ctwaClid},
      ${sourceApp},
      ${new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(recebidaEm)},
      'Novo Lead',
      'plataforma'
    )
    ON CONFLICT (lead_id) DO UPDATE SET
      -- Atualiza nome se estava vazio
      lead_nome      = CASE
        WHEN TRIM(COALESCE(fb_leads.lead_nome, '')) = '' AND ${pushName} IS NOT NULL
        THEN ${pushName}
        ELSE fb_leads.lead_nome
      END,
      -- Atualiza atribuição CTWA só se ainda não tinha (preserva o primeiro clique)
      ctwa_clid      = COALESCE(fb_leads.ctwa_clid,  ${ctwaClid}),
      ad_id          = COALESCE(fb_leads.ad_id,       ${adId}),
      source_app     = COALESCE(fb_leads.source_app,  ${sourceApp}),
      -- Marca como plataforma na primeira vez que passar pelo nosso webhook
      webhook_origem = COALESCE(fb_leads.webhook_origem, 'plataforma')
  `;

  // Lê o estado atual do lead e os labels das etapas base deste cliente
  type StageLabel = { etapa: string; etapa_label: string };
  const stageLabels = await db.$queryRaw<StageLabel[]>`
    SELECT ccw.etapa, ccw.etapa_label
    FROM cliente_crm_webhooks ccw
    JOIN clientes c ON c.id = ccw.cliente_id
    WHERE lower(c.n8n_client_key) = lower(${clientKey})
      AND ccw.etapa IN ('novo_lead', 'nao_classificado')
  `;

  const labelNovoLead = stageLabels.find(s => s.etapa === "novo_lead")?.etapa_label ?? "Novo Lead";
  const naoClassStage = stageLabels.find(s => s.etapa === "nao_classificado");

  type LeadFase = { fase: string; ad_id: string | null; ctwa_clid: string | null; source_app: string | null };
  const currentLead = await db.$queryRaw<LeadFase[]>`
    SELECT fase, ad_id, ctwa_clid, source_app
    FROM fb_leads
    WHERE lead_id = ${leadId}
      AND lower(client_key) = lower(${clientKey})
    LIMIT 1
  `;

  // Re-entrada: lead já trabalhado volta a entrar em contato
  if (currentLead.length > 0 && naoClassStage) {
    const { fase, ad_id: leadAdId, ctwa_clid: leadCtwaClid, source_app: leadSourceApp } = currentLead[0];
    const isUntouched = fase === labelNovoLead || fase === naoClassStage.etapa_label;

    if (!isUntouched) {
      await db.$executeRaw`
        INSERT INTO crm_reentradas (lead_id, client_key, fase_anterior, reentrada_em, ad_id, ctwa_clid, source_app)
        VALUES (${leadId}, ${clientKey}, ${fase}, NOW(), ${leadAdId}, ${leadCtwaClid}, ${leadSourceApp})
      `;
      await db.$executeRaw`
        UPDATE fb_leads
        SET fase = ${naoClassStage.etapa_label}, reentradas = reentradas + 1
        WHERE lead_id = ${leadId}
          AND lower(client_key) = lower(${clientKey})
      `;
    }
  }

  return {
    leadId,
    isNew: currentLead.length === 0 || currentLead[0].fase === labelNovoLead,
  };
}
