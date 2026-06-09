/**
 * Recria os workflows extras que foram deletados do n8n (mas ainda existem no banco).
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });
import { db } from "@/lib/db";
import { buildCrmWorkflow, LABEL_FASE } from "@/lib/crm-webhook-template";
import { createWorkflow, activateWorkflow, webhookBaseUrl } from "@/lib/n8n-client";

const POSTGRES_CREDENTIAL_ID   = "uhiDzKcnDvzDL7OQ";
const POSTGRES_CREDENTIAL_NAME = "Postgres EasyPanel";

async function main() {
  if (!process.env.N8N_API_URL || !process.env.N8N_API_KEY) {
    throw new Error("N8N_API_URL ou N8N_API_KEY não configurados.");
  }

  const extras = await db.clienteCrmWebhook.findMany({
    where: { ehExtra: true },
    include: { cliente: { select: { nome: true, n8nClientKey: true } } },
    orderBy: [{ clienteId: "asc" }, { etapaLabel: "asc" }],
  });

  console.log(`Recriando ${extras.length} webhook(s) extra(s) órfão(s)...\n`);
  const base = webhookBaseUrl();

  for (const extra of extras) {
    const clientName = extra.cliente.nome;
    const clientKey  = extra.cliente.n8nClientKey!;
    console.log(`▶ [${clientName}] "${extra.etapaLabel}" (path=${extra.webhookPath})`);

    try {
      const { workflow } = buildCrmWorkflow({
        clientKey,
        clientName,
        etapa:                  extra.etapa,
        faseLabel:              extra.etapaLabel,
        ehNovoLead:             false,
        customPath:             extra.webhookPath,
        postgresCredentialId:   POSTGRES_CREDENTIAL_ID,
        postgresCredentialName: POSTGRES_CREDENTIAL_NAME,
      });

      const created = await createWorkflow(workflow);
      try { await activateWorkflow(created.id); }
      catch (err) { console.warn(`  ⚠ falha ao ativar ${created.id}:`, err); }

      const webhookUrl = `${base}/webhook/${extra.webhookPath}`;

      await db.clienteCrmWebhook.update({
        where: { id: extra.id },
        data: { n8nWorkflowId: created.id, webhookUrl },
      });

      console.log(`  ✅ recriado: ${created.id} → ${webhookUrl}`);
    } catch (err) {
      console.error(`  ❌ ERRO:`, err);
    }
  }

  console.log("\nConcluído.");
}

main().catch(console.error).finally(() => db.$disconnect());
