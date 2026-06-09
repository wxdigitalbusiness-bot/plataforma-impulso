// Builder do JSON de workflow n8n pra receber webhooks CRM por cliente/etapa.
// Cada workflow tem 3 nodes: Webhook (trigger) → SET (mapping) → Postgres (UPSERT).
//
// Pra etapa "novo_lead": INSERT completo de todos os campos do lead.
// Pra demais etapas: UPSERT que só atualiza a coluna `fase`.
//
// O workflow gerado é equivalente ao padrão das workflows manuais existentes
// (ex: w7PJosdxSsl5Due1 = S|C - NOVO LEAD - OK).

import { randomUUID } from "node:crypto";

export type EtapaCrm =
  | "novo_lead"
  | "nao_classificado"
  | "qualificado"
  | "perdido"
  | "concluido";

export const ETAPAS_CRM: EtapaCrm[] = [
  "novo_lead",
  "nao_classificado",
  "qualificado",
  "perdido",
  "concluido",
];

/** Label como aparece em fb_leads.fase (compatível com queries do dashboard). */
export const LABEL_FASE: Record<EtapaCrm, string> = {
  novo_lead:        "Novo Lead",
  nao_classificado: "Não classificado",
  qualificado:      "Qualificado",
  perdido:          "Perdido",
  concluido:        "Concluido",
};

/** Label amigável pra UI. */
export const LABEL_ETAPA: Record<EtapaCrm, string> = {
  novo_lead:        "Novo Lead",
  nao_classificado: "Não classificado",
  qualificado:      "Qualificado",
  perdido:          "Perdido",
  concluido:        "Negócio concluído",
};

/** Slug seguro pra usar no path do webhook. */
function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // tira acentos
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Path único do webhook (ex: "crm/sc/novo-lead"). */
export function webhookPath(clientKey: string, etapa: EtapaCrm): string {
  const etapaSlug = etapa.replace(/_/g, "-");
  return `crm/${slug(clientKey)}/${etapaSlug}`;
}

/**
 * Extrai o "path" do webhook do que o usuário digitou — aceita:
 *   - URL completa: "https://x.com/webhook/sarah-novolead" → "sarah-novolead"
 *   - URL sem domínio: "/webhook/sarah-novolead" → "sarah-novolead"
 *   - Path puro: "sarah-novolead" → "sarah-novolead"
 *   - Path com slashes: "crm/sc/qualif" → "crm/sc/qualif"
 *
 * Retorna null se o input é inválido (vazio, só espaços, etc).
 */
export function extrairWebhookPath(input: string): string | null {
  if (!input) return null;
  let s = input.trim();
  if (s === "") return null;

  // Se vier URL completa, pega só após /webhook/
  const m = s.match(/\/webhook(?:-test)?\/(.+)$/);
  if (m) s = m[1];

  // Limpa querystring e fragment
  s = s.split("?")[0].split("#")[0];

  // Tira barras nas pontas
  s = s.replace(/^\/+|\/+$/g, "");

  // Sanitiza: permite letras, números, hífen, underscore, ponto, barra
  s = s.replace(/[^a-zA-Z0-9._\-/]/g, "");

  return s === "" ? null : s;
}

// ─── Builders dos nodes ───────────────────────────────────────────────────────

type N8nNode = {
  parameters: Record<string, unknown>;
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  webhookId?: string;
  credentials?: Record<string, { id: string; name: string }>;
};

function webhookNode(path: string): N8nNode {
  return {
    parameters: {
      httpMethod: "POST",
      path,
      responseMode: "lastNode",
      options: {},
    },
    id: randomUUID(),
    name: "Webhook CRM",
    type: "n8n-nodes-base.webhook",
    typeVersion: 2,
    position: [0, 0],
    webhookId: randomUUID(),
  };
}

function tratamentoNode(clientKey: string, clientName: string, fase: string): N8nNode {
  return {
    parameters: {
      assignments: {
        assignments: [
          { id: randomUUID(), name: "Fase",         value: fase,                                                  type: "string" },
          { id: randomUUID(), name: "ClientKey",    value: clientKey,                                             type: "string" },
          { id: randomUUID(), name: "ClientName",   value: clientName,                                            type: "string" },
          { id: randomUUID(), name: "LeadId",       value: "={{ $json.body.lead.id }}",                           type: "string" },
          { id: randomUUID(), name: "LeadNome",     value: "={{ $json.body.lead.name }}",                         type: "string" },
          { id: randomUUID(), name: "LeadWhatsapp", value: "={{ $json.body.lead.phone }}",                        type: "string" },
          { id: randomUUID(), name: "UTMSource",    value: "={{ $json.body.lead.utm_source || null }}",           type: "string" },
          { id: randomUUID(), name: "LeadAnuncio",  value: "={{ $json.body.lead.utm_content }}",                  type: "string" },
          { id: randomUUID(), name: "ad_id",        value: "={{ $json.body.lead.sourceId || $json.body.lead.ad_id || null }}", type: "string" },
          { id: randomUUID(), name: "DataCriação",  value: "={{ $json.body.lead.createdAt || new Date().toISOString() }}",     type: "string" },
        ],
      },
      options: {},
    },
    id: randomUUID(),
    name: "TRATAMENTO",
    type: "n8n-nodes-base.set",
    typeVersion: 3.4,
    position: [280, 0],
  };
}

/** SQL pra INSERT completo (usado pela etapa "novo_lead"). */
function sqlInsertCompleto(): string {
  // Espelha o INSERT da workflow w7PJosdxSsl5Due1 (S|C - NOVO LEAD - OK)
  return `INSERT INTO fb_leads (
  lead_id, client_key, client_name, lead_nome, lead_whatsapp,
  utm_source, ad_id, ad_name, data_criacao, fase
) VALUES (
  '{{$json["LeadId"]}}',
  '{{$json["ClientKey"]}}',
  '{{$json["ClientName"]}}',
  '{{$json["LeadNome"] ? $json["LeadNome"].replace(/'/g, "''") : ""}}',
  '{{$json["LeadWhatsapp"]}}',
  '{{$json["UTMSource"]}}',
  '{{$json["ad_id"]}}',
  '{{$json["LeadAnuncio"]}}',
  '{{ new Date($json["DataCriação"]).toISOString().split("T")[0] }}',
  '{{$json["Fase"] || "Novo Lead"}}'
)
ON CONFLICT (lead_id) DO UPDATE SET
  client_key    = EXCLUDED.client_key,
  client_name   = EXCLUDED.client_name,
  lead_nome     = EXCLUDED.lead_nome,
  lead_whatsapp = EXCLUDED.lead_whatsapp,
  utm_source    = EXCLUDED.utm_source,
  ad_id         = EXCLUDED.ad_id,
  ad_name       = EXCLUDED.ad_name,
  data_criacao  = EXCLUDED.data_criacao,
  fase          = COALESCE(EXCLUDED.fase, fb_leads.fase),
  created_at    = now();`;
}

/**
 * SQL pra etapas que só atualizam a `fase` (qualificado, perdido, concluído, etc).
 *
 * Estratégia de dois passos em uma transação (CTE):
 * 1. Tenta UPDATE pelo telefone — cobre o caso em que o CRM envia um lead_id
 *    diferente no webhook de atualização vs o lead_id original do "novo_lead".
 * 2. Se nenhuma linha foi atualizada por telefone, faz INSERT com ON CONFLICT
 *    por lead_id como fallback (insere lead novo ou atualiza pelo lead_id).
 */
function sqlUpdateFase(): string {
  return `WITH phone_match AS (
  UPDATE fb_leads
  SET fase = '{{$json["Fase"]}}'
  WHERE lower(client_key) = lower('{{$json["ClientKey"]}}')
    AND TRIM(COALESCE(lead_whatsapp, '')) <> ''
    AND TRIM(lead_whatsapp) = TRIM('{{$json["LeadWhatsapp"]}}')
  RETURNING lead_id
)
INSERT INTO fb_leads (
  lead_id, client_key, client_name, lead_nome, lead_whatsapp,
  utm_source, ad_id, data_criacao, fase
)
SELECT
  '{{$json["LeadId"]}}',
  '{{$json["ClientKey"]}}',
  '{{$json["ClientName"]}}',
  '{{$json["LeadNome"] ? $json["LeadNome"].replace(/'/g, "''") : ""}}',
  '{{$json["LeadWhatsapp"]}}',
  '{{$json["UTMSource"]}}',
  '{{$json["ad_id"]}}',
  '{{ new Date($json["DataCriação"]).toISOString().split("T")[0] }}',
  '{{$json["Fase"]}}'
WHERE NOT EXISTS (SELECT 1 FROM phone_match)
ON CONFLICT (lead_id) DO UPDATE SET
  fase = EXCLUDED.fase`;
}

function postgresNode(sql: string, credentialId?: string, credentialName?: string): N8nNode {
  const node: N8nNode = {
    parameters: {
      operation: "executeQuery",
      query: sql,
      options: {},
    },
    id: randomUUID(),
    name: "Salvar em fb_leads",
    type: "n8n-nodes-base.postgres",
    typeVersion: 2.6,
    position: [560, 0],
  };
  if (credentialId && credentialName) {
    node.credentials = {
      postgres: { id: credentialId, name: credentialName },
    };
  }
  return node;
}

// ─── Builder principal ────────────────────────────────────────────────────────

export type WorkflowBuildInput = {
  clientKey: string;
  clientName: string;
  /** Slug da etapa (ex: "novo_lead", "em_negociacao"). Pode ser de uma base ou extra. */
  etapa: string;
  /** Label amigável que vira o valor de fb_leads.fase (ex: "Novo Lead", "Em negociação"). */
  faseLabel: string;
  /** Se é a etapa "novo_lead" — usa INSERT completo. Demais usam UPDATE só da fase. */
  ehNovoLead?: boolean;
  /** Path customizado pro webhook. Se omitido, usa o auto-gerado pelo `webhookPath()`. */
  customPath?: string;
  /** Credential ID do Postgres no n8n. Opcional — se omitido, n8n tenta auto-assign. */
  postgresCredentialId?: string;
  /** Nome da credential pra display. */
  postgresCredentialName?: string;
};

export type N8nWorkflowJson = {
  name: string;
  nodes: N8nNode[];
  connections: Record<string, { main: Array<Array<{ node: string; type: string; index: number }>> }>;
  settings: Record<string, unknown>;
};

/** Constrói o JSON completo de um workflow CRM pra uma etapa do cliente. */
export function buildCrmWorkflow(input: WorkflowBuildInput): {
  workflow: N8nWorkflowJson;
  path: string;
} {
  const path     = input.customPath ?? webhookPathLivre(input.clientKey, input.etapa);
  const fase     = input.faseLabel;
  const ehNovo   = input.ehNovoLead ?? (input.etapa === "novo_lead");
  const sql      = ehNovo ? sqlInsertCompleto() : sqlUpdateFase();

  const wh   = webhookNode(path);
  const trat = tratamentoNode(input.clientKey, input.clientName, fase);
  const pg   = postgresNode(sql, input.postgresCredentialId, input.postgresCredentialName);

  return {
    path,
    workflow: {
      name: `[CRM] ${input.clientName} - ${fase}`,
      nodes: [wh, trat, pg],
      connections: {
        [wh.name]:   { main: [[{ node: trat.name, type: "main", index: 0 }]] },
        [trat.name]: { main: [[{ node: pg.name,   type: "main", index: 0 }]] },
      },
      settings: { executionOrder: "v1" },
    },
  };
}

/** Path auto-gerado livre — funciona pra qualquer slug (base ou extra). */
function webhookPathLivre(clientKey: string, etapa: string): string {
  return `crm/${slug(clientKey)}/${etapa.replace(/_/g, "-")}`;
}

/**
 * Slugifica um label de etapa pra usar como `etapa` slug no banco.
 * Ex: "Em negociação" → "em_negociacao", "Aguardando proposta" → "aguardando_proposta".
 */
export function slugificarEtapa(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
