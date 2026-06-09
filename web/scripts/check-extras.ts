import { config } from "dotenv";
config({ path: ".env.local", override: true });
import { db } from "@/lib/db";

async function main() {
  const extras = await db.clienteCrmWebhook.findMany({
    where: { ehExtra: true },
    include: { cliente: { select: { nome: true, n8nClientKey: true } } },
    orderBy: [{ clienteId: "asc" }, { etapaLabel: "asc" }],
  });

  console.log(`Total extras no banco: ${extras.length}`);
  for (const e of extras) {
    console.log(`  [${e.cliente.nome}] etapa=${e.etapa} label="${e.etapaLabel}" path=${e.webhookPath} n8nId=${e.n8nWorkflowId}`);
  }
}

main().catch(console.error).finally(() => db.$disconnect());
