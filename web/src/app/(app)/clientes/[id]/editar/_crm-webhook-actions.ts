"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  buildCrmWorkflow,
  ETAPAS_CRM,
  LABEL_FASE,
  LABEL_ETAPA,
  extrairWebhookPath,
  slugificarEtapa,
  type EtapaCrm,
} from "@/lib/crm-webhook-template";
import {
  createWorkflow,
  activateWorkflow,
  deleteWorkflow,
  webhookBaseUrl,
} from "@/lib/n8n-client";

const inputSchema = z.object({
  clienteId: z.coerce.number().int().positive(),
});

export type ConfigurarResult =
  | { ok: true; criados: number; webhooks: Array<{ etapa: EtapaCrm; url: string }> }
  | { ok: false; erro: string };

/**
 * Cria (ou recria) os 5 workflows CRM no n8n para o cliente.
 * Se já existirem webhooks, deleta os antigos antes de criar os novos.
 */
export async function configurarCrmWebhooks(
  input: { clienteId: number },
): Promise<ConfigurarResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, erro: "Parâmetros inválidos." };

  const session = await auth();
  if (!session?.user?.email) return { ok: false, erro: "Não autenticado." };

  const cliente = await db.cliente.findUnique({
    where: { id: parsed.data.clienteId },
    select: { id: true, nome: true, n8nClientKey: true },
  });
  if (!cliente) return { ok: false, erro: "Cliente não encontrado." };
  if (!cliente.n8nClientKey || cliente.n8nClientKey.trim() === "") {
    return {
      ok: false,
      erro: "Cliente sem n8n_client_key configurada. Preencha o campo antes de gerar webhooks.",
    };
  }

  // Valida env vars do n8n antes de tudo — assim retorna erro tratado em vez de quebrar.
  if (!process.env.N8N_API_URL || !process.env.N8N_API_KEY) {
    return {
      ok: false,
      erro: "Configuração ausente: defina N8N_API_URL e N8N_API_KEY no .env.local. Gere a chave em Settings → n8n API no n8n.",
    };
  }

  // 1. Apaga webhooks antigos no n8n (se existirem)
  const existentes = await db.clienteCrmWebhook.findMany({
    where: { clienteId: cliente.id },
    select: { id: true, n8nWorkflowId: true },
  });
  for (const w of existentes) {
    try { await deleteWorkflow(w.n8nWorkflowId); }
    catch (err) { console.warn(`[configurarCrmWebhooks] falhou ao deletar ${w.n8nWorkflowId}:`, err); }
  }
  if (existentes.length > 0) {
    await db.clienteCrmWebhook.deleteMany({
      where: { clienteId: cliente.id },
    });
  }

  // 2. Cria 5 workflows novos (um por etapa)
  const base = webhookBaseUrl();
  const criados: Array<{ etapa: EtapaCrm; url: string }> = [];

  for (const etapa of ETAPAS_CRM) {
    try {
      const { workflow, path } = buildCrmWorkflow({
        clientKey:              cliente.n8nClientKey,
        clientName:             cliente.nome,
        etapa,
        faseLabel:              LABEL_FASE[etapa],
        ehNovoLead:             etapa === "novo_lead",
        postgresCredentialId:   process.env.N8N_POSTGRES_CREDENTIAL_ID   ?? "uhiDzKcnDvzDL7OQ",
        postgresCredentialName: process.env.N8N_POSTGRES_CREDENTIAL_NAME ?? "Postgres EasyPanel",
      });

      const created = await createWorkflow(workflow);
      // Ativa pra receber webhook
      try { await activateWorkflow(created.id); }
      catch (err) { console.warn(`[configurarCrmWebhooks] falha ao ativar ${created.id}:`, err); }

      const webhookUrl = `${base}/webhook/${path}`;

      await db.clienteCrmWebhook.create({
        data: {
          clienteId:     cliente.id,
          etapa,
          etapaLabel:    LABEL_ETAPA[etapa],
          ehExtra:       false,
          webhookPath:   path,
          webhookUrl,
          n8nWorkflowId: created.id,
        },
      });

      criados.push({ etapa, url: webhookUrl });
    } catch (err) {
      console.error(`[configurarCrmWebhooks] etapa=${etapa}:`, err);
      return {
        ok: false,
        erro: `Falhou ao criar workflow da etapa "${etapa}": ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  revalidatePath(`/clientes/${cliente.id}/editar`);
  return { ok: true, criados: criados.length, webhooks: criados };
}

// ─── Versão alternativa: aceita paths customizados (1 por etapa) ─────────────

const urlsInputSchema = z.object({
  clienteId: z.coerce.number().int().positive(),
  urls: z.record(
    z.enum(["novo_lead", "nao_classificado", "qualificado", "perdido", "concluido"]),
    z.string(),
  ),
});

export type CriarComUrlsResult =
  | { ok: true; criados: number; webhooks: Array<{ etapa: EtapaCrm; url: string }> }
  | { ok: false; erro: string; etapasComErro?: EtapaCrm[] };

/**
 * Cria 5 workflows usando paths customizados que o usuário forneceu.
 * Aceita URL completa ou path puro (extrai usando extrairWebhookPath).
 */
export async function criarWorkflowsComUrls(
  input: { clienteId: number; urls: Partial<Record<EtapaCrm, string>> },
): Promise<CriarComUrlsResult> {
  const parsed = urlsInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, erro: "Parâmetros inválidos." };

  const session = await auth();
  if (!session?.user?.email) return { ok: false, erro: "Não autenticado." };

  const cliente = await db.cliente.findUnique({
    where: { id: parsed.data.clienteId },
    select: { id: true, nome: true, n8nClientKey: true },
  });
  if (!cliente) return { ok: false, erro: "Cliente não encontrado." };
  if (!cliente.n8nClientKey || cliente.n8nClientKey.trim() === "") {
    return { ok: false, erro: "Cliente sem n8n_client_key configurada. Preencha o campo acima antes." };
  }

  // Valida que pelo menos uma URL foi preenchida + extrai paths
  const pathsValidos: Partial<Record<EtapaCrm, string>> = {};
  const etapasComErro: EtapaCrm[] = [];
  for (const etapa of ETAPAS_CRM) {
    const raw = parsed.data.urls[etapa];
    if (!raw || raw.trim() === "") continue; // não preenchida, ignora
    const path = extrairWebhookPath(raw);
    if (!path) {
      etapasComErro.push(etapa);
      continue;
    }
    pathsValidos[etapa] = path;
  }

  if (Object.keys(pathsValidos).length === 0) {
    return { ok: false, erro: "Preencha pelo menos uma URL." };
  }
  if (etapasComErro.length > 0) {
    return {
      ok: false,
      erro: "Algumas URLs são inválidas — corrija e tente novamente.",
      etapasComErro,
    };
  }

  if (!process.env.N8N_API_URL || !process.env.N8N_API_KEY) {
    return {
      ok: false,
      erro: "Configuração ausente: defina N8N_API_URL e N8N_API_KEY no .env.local. Gere a chave em Settings → n8n API no n8n.",
    };
  }

  // Apaga webhooks antigos do cliente (do n8n + do banco)
  const existentes = await db.clienteCrmWebhook.findMany({
    where: { clienteId: cliente.id },
    select: { id: true, n8nWorkflowId: true },
  });
  for (const w of existentes) {
    try { await deleteWorkflow(w.n8nWorkflowId); }
    catch (err) { console.warn(`[criarWorkflowsComUrls] falhou ao deletar ${w.n8nWorkflowId}:`, err); }
  }
  if (existentes.length > 0) {
    await db.clienteCrmWebhook.deleteMany({ where: { clienteId: cliente.id } });
  }

  // Cria workflows para cada etapa preenchida
  const base = webhookBaseUrl();
  const criados: Array<{ etapa: EtapaCrm; url: string }> = [];

  for (const [etapa, path] of Object.entries(pathsValidos) as Array<[EtapaCrm, string]>) {
    try {
      const { workflow } = buildCrmWorkflow({
        clientKey:  cliente.n8nClientKey,
        clientName: cliente.nome,
        etapa,
        faseLabel:  LABEL_FASE[etapa],
        ehNovoLead: etapa === "novo_lead",
        customPath: path,
      });

      const created = await createWorkflow(workflow);
      try { await activateWorkflow(created.id); }
      catch (err) { console.warn(`[criarWorkflowsComUrls] falha ao ativar ${created.id}:`, err); }

      const webhookUrl = `${base}/webhook/${path}`;

      await db.clienteCrmWebhook.create({
        data: {
          clienteId:     cliente.id,
          etapa,
          etapaLabel:    LABEL_ETAPA[etapa],
          ehExtra:       false,
          webhookPath:   path,
          webhookUrl,
          n8nWorkflowId: created.id,
        },
      });

      criados.push({ etapa, url: webhookUrl });
    } catch (err) {
      console.error(`[criarWorkflowsComUrls] etapa=${etapa}:`, err);
      return {
        ok: false,
        erro: `Falhou na etapa "${etapa}": ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  revalidatePath(`/clientes/${cliente.id}/editar`);
  return { ok: true, criados: criados.length, webhooks: criados };
}

// ─── Etapas EXTRAS (customizadas por cliente) ────────────────────────────────

const adicionarEtapaSchema = z.object({
  clienteId: z.coerce.number().int().positive(),
  label:     z.string().trim().min(2, "Mínimo 2 caracteres").max(60, "Máximo 60 caracteres"),
});

export type AdicionarEtapaResult =
  | { ok: true; etapa: string; webhookUrl: string }
  | { ok: false; erro: string };

/**
 * Adiciona uma etapa extra (customizada) ao cliente. Cria 1 workflow no n8n
 * com path auto-gerado a partir do label. Comportamento de salvar = "só atualiza fase"
 * (não tenta INSERT completo, pois extra nunca é a etapa inicial).
 */
export async function adicionarEtapaExtra(
  input: { clienteId: number; label: string },
): Promise<AdicionarEtapaResult> {
  const parsed = adicionarEtapaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Parâmetros inválidos." };
  }

  const session = await auth();
  if (!session?.user?.email) return { ok: false, erro: "Não autenticado." };

  const cliente = await db.cliente.findUnique({
    where: { id: parsed.data.clienteId },
    select: { id: true, nome: true, n8nClientKey: true },
  });
  if (!cliente) return { ok: false, erro: "Cliente não encontrado." };
  if (!cliente.n8nClientKey || cliente.n8nClientKey.trim() === "") {
    return { ok: false, erro: "Cliente sem n8n_client_key. Preencha o campo acima antes." };
  }
  if (!process.env.N8N_API_URL || !process.env.N8N_API_KEY) {
    return { ok: false, erro: "Configuração N8N_API_URL/KEY ausente no .env.local." };
  }

  const label = parsed.data.label;
  const etapaSlug = slugificarEtapa(label);
  if (!etapaSlug) return { ok: false, erro: "Label inválido (use letras/números)." };

  // Não permitir colidir com etapas base ou existentes
  const existente = await db.clienteCrmWebhook.findUnique({
    where: { clienteId_etapa: { clienteId: cliente.id, etapa: etapaSlug } },
  });
  if (existente) {
    return { ok: false, erro: `Já existe uma etapa "${existente.etapaLabel}" pra esse cliente.` };
  }

  try {
    const { workflow, path } = buildCrmWorkflow({
      clientKey:  cliente.n8nClientKey,
      clientName: cliente.nome,
      etapa:      etapaSlug,
      faseLabel:  label,
      ehNovoLead: false,
    });

    const created = await createWorkflow(workflow);
    try { await activateWorkflow(created.id); }
    catch (err) { console.warn(`[adicionarEtapaExtra] falha ao ativar ${created.id}:`, err); }

    const webhookUrl = `${webhookBaseUrl()}/webhook/${path}`;

    await db.clienteCrmWebhook.create({
      data: {
        clienteId:     cliente.id,
        etapa:         etapaSlug,
        etapaLabel:    label,
        ehExtra:       true,
        webhookPath:   path,
        webhookUrl,
        n8nWorkflowId: created.id,
      },
    });

    revalidatePath(`/clientes/${cliente.id}/editar`);
    return { ok: true, etapa: etapaSlug, webhookUrl };
  } catch (err) {
    console.error("[adicionarEtapaExtra]", err);
    return {
      ok: false,
      erro: `Falhou ao criar etapa: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

const removerEtapaSchema = z.object({ webhookId: z.coerce.number().int().positive() });

/** Remove UMA etapa específica (deleta workflow + linha do banco). */
export async function removerEtapaWebhook(
  input: { webhookId: number },
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const parsed = removerEtapaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, erro: "Parâmetros inválidos." };

  const session = await auth();
  if (!session?.user?.email) return { ok: false, erro: "Não autenticado." };

  const wh = await db.clienteCrmWebhook.findUnique({
    where: { id: BigInt(parsed.data.webhookId) },
    select: { id: true, clienteId: true, n8nWorkflowId: true },
  });
  if (!wh) return { ok: false, erro: "Webhook não encontrado." };

  try { await deleteWorkflow(wh.n8nWorkflowId); }
  catch (err) { console.warn(`[removerEtapaWebhook] falha ao deletar workflow ${wh.n8nWorkflowId}:`, err); }

  await db.clienteCrmWebhook.delete({ where: { id: wh.id } });
  revalidatePath(`/clientes/${wh.clienteId}/editar`);
  return { ok: true };
}

/**
 * Regenera apenas os 5 webhooks BASE para o cliente, preservando etapas extras.
 * Útil quando o SQL dos workflows mudou e é necessário atualizar sem perder os extras.
 */
export async function regenerarWebhooksBase(
  input: { clienteId: number },
): Promise<ConfigurarResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, erro: "Parâmetros inválidos." };

  const session = await auth();
  if (!session?.user?.email) return { ok: false, erro: "Não autenticado." };

  const cliente = await db.cliente.findUnique({
    where: { id: parsed.data.clienteId },
    select: { id: true, nome: true, n8nClientKey: true },
  });
  if (!cliente) return { ok: false, erro: "Cliente não encontrado." };
  if (!cliente.n8nClientKey || cliente.n8nClientKey.trim() === "") {
    return { ok: false, erro: "Cliente sem n8n_client_key configurada." };
  }
  if (!process.env.N8N_API_URL || !process.env.N8N_API_KEY) {
    return { ok: false, erro: "Configuração ausente: defina N8N_API_URL e N8N_API_KEY no .env.local." };
  }

  // Apaga apenas os 5 base (não os extras)
  const existentesBase = await db.clienteCrmWebhook.findMany({
    where: { clienteId: cliente.id, ehExtra: false },
    select: { id: true, n8nWorkflowId: true },
  });
  for (const w of existentesBase) {
    try { await deleteWorkflow(w.n8nWorkflowId); }
    catch (err) { console.warn(`[regenerarWebhooksBase] falhou ao deletar ${w.n8nWorkflowId}:`, err); }
  }
  if (existentesBase.length > 0) {
    await db.clienteCrmWebhook.deleteMany({
      where: { clienteId: cliente.id, ehExtra: false },
    });
  }

  // Recria os 5 base com o SQL atualizado
  const base = webhookBaseUrl();
  const criados: Array<{ etapa: EtapaCrm; url: string }> = [];

  for (const etapa of ETAPAS_CRM) {
    try {
      const { workflow, path } = buildCrmWorkflow({
        clientKey:              cliente.n8nClientKey,
        clientName:             cliente.nome,
        etapa,
        faseLabel:              LABEL_FASE[etapa],
        ehNovoLead:             etapa === "novo_lead",
        postgresCredentialId:   process.env.N8N_POSTGRES_CREDENTIAL_ID   ?? "uhiDzKcnDvzDL7OQ",
        postgresCredentialName: process.env.N8N_POSTGRES_CREDENTIAL_NAME ?? "Postgres EasyPanel",
      });

      const created = await createWorkflow(workflow);
      try { await activateWorkflow(created.id); }
      catch (err) { console.warn(`[regenerarWebhooksBase] falha ao ativar ${created.id}:`, err); }

      const webhookUrl = `${base}/webhook/${path}`;

      await db.clienteCrmWebhook.create({
        data: {
          clienteId:     cliente.id,
          etapa,
          etapaLabel:    LABEL_ETAPA[etapa],
          ehExtra:       false,
          webhookPath:   path,
          webhookUrl,
          n8nWorkflowId: created.id,
        },
      });

      criados.push({ etapa, url: webhookUrl });
    } catch (err) {
      console.error(`[regenerarWebhooksBase] etapa=${etapa}:`, err);
      return {
        ok: false,
        erro: `Falhou ao recriar workflow da etapa "${etapa}": ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  revalidatePath(`/clientes/${cliente.id}/editar`);
  return { ok: true, criados: criados.length, webhooks: criados };
}

/** Exclui todos os webhooks CRM do cliente (do banco + do n8n). */
export async function excluirCrmWebhooks(
  input: { clienteId: number },
): Promise<{ ok: true; deletados: number } | { ok: false; erro: string }> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, erro: "Parâmetros inválidos." };

  const session = await auth();
  if (!session?.user?.email) return { ok: false, erro: "Não autenticado." };

  const webhooks = await db.clienteCrmWebhook.findMany({
    where: { clienteId: parsed.data.clienteId },
    select: { id: true, n8nWorkflowId: true },
  });

  for (const w of webhooks) {
    try { await deleteWorkflow(w.n8nWorkflowId); }
    catch (err) { console.warn(`[excluirCrmWebhooks] falhou ao deletar ${w.n8nWorkflowId}:`, err); }
  }

  await db.clienteCrmWebhook.deleteMany({
    where: { clienteId: parsed.data.clienteId },
  });

  revalidatePath(`/clientes/${parsed.data.clienteId}/editar`);
  return { ok: true, deletados: webhooks.length };
}
