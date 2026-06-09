/**
 * Script: Regenera os 5 workflows CRM base para os clientes cujos registros
 * foram deletados do banco pelo script anterior (que falhou antes de recriar).
 *
 * Execução:
 *   N8N_API_URL=... N8N_API_KEY=... npx tsx --tsconfig tsconfig.json scripts/regenerar-todos-clientes.ts
 */

import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });
import { db } from "@/lib/db";
import {
  buildCrmWorkflow,
  ETAPAS_CRM,
  LABEL_FASE,
  LABEL_ETAPA,
} from "@/lib/crm-webhook-template";
import {
  createWorkflow,
  activateWorkflow,
  deleteWorkflow,
  listWorkflows,
  webhookBaseUrl,
} from "@/lib/n8n-client";

// IDs dos 7 clientes que precisam ter os base webhooks recriados
// (Fest Pizza id=8 já está OK com os 5 base workflows regenerados)
const IDS_ALVO = [8, 10, 11, 12, 13, 14, 15, 17]; // 8 = Fest Pizza

// Credential do Postgres configurada no n8n
const POSTGRES_CREDENTIAL_ID   = "uhiDzKcnDvzDL7OQ";
const POSTGRES_CREDENTIAL_NAME = "Postgres EasyPanel";

async function regenerarCliente(cliente: {
  id: number;
  nome: string;
  n8nClientKey: string;
}) {
  console.log(`\n▶ [${cliente.nome}] (id=${cliente.id}, key=${cliente.n8nClientKey})`);

  // 1. Buscar workflows antigos no n8n pelo prefixo "[CRM] <clientName>"
  const prefixo = `[CRM] ${cliente.nome}`;
  const todosN8n = await listWorkflows({ name: prefixo });
  const crmAntigos = todosN8n.filter(w => w.name.startsWith(prefixo));
  console.log(`  → ${crmAntigos.length} workflow(s) antigo(s) no n8n`);

  // 2. Deletar do n8n
  for (const w of crmAntigos) {
    try {
      await deleteWorkflow(w.id);
      console.log(`  🗑  deletado: "${w.name}" (${w.id})`);
    } catch (err) {
      console.warn(`  ⚠ falhou ao deletar ${w.id}:`, err);
    }
  }

  // 3. Limpar eventuais registros base órfãos no banco
  await db.clienteCrmWebhook.deleteMany({
    where: { clienteId: cliente.id, ehExtra: false },
  });

  // 4. Recriar os 5 com o SQL atualizado
  const base = webhookBaseUrl();
  let criados = 0;

  for (const etapa of ETAPAS_CRM) {
    const { workflow, path } = buildCrmWorkflow({
      clientKey:              cliente.n8nClientKey,
      clientName:             cliente.nome,
      etapa,
      faseLabel:              LABEL_FASE[etapa],
      ehNovoLead:             etapa === "novo_lead",
      postgresCredentialId:   POSTGRES_CREDENTIAL_ID,
      postgresCredentialName: POSTGRES_CREDENTIAL_NAME,
    });

    const created = await createWorkflow(workflow);

    try { await activateWorkflow(created.id); }
    catch (err) { console.warn(`  ⚠ falha ao ativar ${created.id}:`, err); }

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

    criados++;
    console.log(`  ✓ ${etapa} → ${webhookUrl}`);
  }

  console.log(`  ✅ ${criados} workflows regenerados para ${cliente.nome}`);
}

async function main() {
  console.log("=== Regeneração em lote dos workflows CRM base ===\n");

  if (!process.env.N8N_API_URL || !process.env.N8N_API_KEY) {
    throw new Error(
      "N8N_API_URL ou N8N_API_KEY não configurados.\n" +
      "Use: N8N_API_URL=... N8N_API_KEY=... npx tsx --tsconfig tsconfig.json scripts/regenerar-todos-clientes.ts"
    );
  }

  const clientes = await db.cliente.findMany({
    where: { id: { in: IDS_ALVO } },
    select: { id: true, nome: true, n8nClientKey: true },
    orderBy: { nome: "asc" },
  });

  console.log(`Clientes a processar: ${clientes.length}`);
  clientes.forEach(c => console.log(`  - ${c.nome} (id=${c.id}, key=${c.n8nClientKey})`));

  let ok = 0;
  let erros = 0;

  for (const cliente of clientes) {
    if (!cliente.n8nClientKey) {
      console.log(`\n⚠ [${cliente.nome}] sem n8nClientKey — pulando`);
      continue;
    }
    try {
      await regenerarCliente({
        id: cliente.id,
        nome: cliente.nome,
        n8nClientKey: cliente.n8nClientKey,
      });
      ok++;
    } catch (err) {
      console.error(`\n❌ [${cliente.nome}] ERRO:`, err);
      erros++;
    }
  }

  console.log(`\n=== Concluído: ${ok} sucesso, ${erros} erros ===`);
}

main()
  .catch(err => { console.error("Erro fatal:", err); process.exit(1); })
  .finally(() => db.$disconnect());
