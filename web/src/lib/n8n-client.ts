// Cliente HTTP minimalista pra n8n REST API.
// Usado pra criar/atualizar/deletar workflows programaticamente.
//
// Configuração via env:
//   N8N_API_URL  = https://impulso-n8n.drx3h6.easypanel.host/api/v1
//   N8N_API_KEY  = <chave gerada no n8n: Settings → n8n API>

const API_URL = process.env.N8N_API_URL;
const API_KEY = process.env.N8N_API_KEY;

function ensureEnv(): { url: string; key: string } {
  if (!API_URL || !API_KEY) {
    throw new Error(
      "N8N_API_URL e N8N_API_KEY são obrigatórios no .env. " +
      "Gere a chave em Settings → n8n API no n8n.",
    );
  }
  return { url: API_URL.replace(/\/+$/, ""), key: API_KEY };
}

async function n8nFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { url, key } = ensureEnv();
  return fetch(`${url}${path}`, {
    ...init,
    headers: {
      "X-N8N-API-KEY": key,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

export type N8nCreatedWorkflow = {
  id: string;
  name: string;
  active: boolean;
};

/** Cria um workflow. Retorna o objeto criado (com o ID gerado pelo n8n). */
export async function createWorkflow(workflow: unknown): Promise<N8nCreatedWorkflow> {
  const r = await n8nFetch("/workflows", {
    method: "POST",
    body: JSON.stringify(workflow),
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`n8n createWorkflow ${r.status}: ${txt.slice(0, 500)}`);
  }
  return await r.json() as N8nCreatedWorkflow;
}

/** Ativa um workflow (necessário pro webhook receber chamadas). */
export async function activateWorkflow(workflowId: string): Promise<void> {
  const r = await n8nFetch(`/workflows/${workflowId}/activate`, {
    method: "POST",
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`n8n activateWorkflow ${workflowId} ${r.status}: ${txt.slice(0, 500)}`);
  }
}

/** Deleta um workflow. */
export async function deleteWorkflow(workflowId: string): Promise<void> {
  const r = await n8nFetch(`/workflows/${workflowId}`, {
    method: "DELETE",
  });
  // 404 é OK (já não existe)
  if (!r.ok && r.status !== 404) {
    const txt = await r.text();
    throw new Error(`n8n deleteWorkflow ${workflowId} ${r.status}: ${txt.slice(0, 500)}`);
  }
}

/** Lista todos os workflows (com paginação). */
export type N8nWorkflowSummary = { id: string; name: string; active: boolean };
export async function listWorkflows(opts?: { name?: string }): Promise<N8nWorkflowSummary[]> {
  const params = new URLSearchParams({ limit: "250" });
  if (opts?.name) params.set("name", opts.name);
  const r = await n8nFetch(`/workflows?${params}`);
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`n8n listWorkflows ${r.status}: ${txt.slice(0, 300)}`);
  }
  const j = await r.json() as { data?: N8nWorkflowSummary[] } | N8nWorkflowSummary[];
  return Array.isArray(j) ? j : (j.data ?? []);
}

/** Lista credentials disponíveis (pra descobrir o ID do Postgres). */
export type N8nCredential = { id: string; name: string; type: string };
export async function listCredentials(): Promise<N8nCredential[]> {
  const r = await n8nFetch("/credentials/schema/postgres");
  // /credentials endpoint pode não estar disponível dependendo do plano.
  // Tentamos primeiro listar via /credentials que retorna metadata.
  // Se 404, retornamos vazio (caller pode auto-assign).
  if (r.status === 404) return [];
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`n8n listCredentials ${r.status}: ${txt.slice(0, 200)}`);
  }
  const j = await r.json() as { data?: N8nCredential[] } | N8nCredential[];
  return Array.isArray(j) ? j : (j.data ?? []);
}

/** Tenta descobrir o webhook URL público da instância (sem /api/v1). */
export function webhookBaseUrl(): string {
  const { url } = ensureEnv();
  // /api/v1 → tirar pra ficar com a base
  return url.replace(/\/api\/v\d+$/, "");
}
