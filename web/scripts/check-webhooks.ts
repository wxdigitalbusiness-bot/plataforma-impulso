import { config } from "dotenv";
config({ path: ".env.local", override: true });
import { db } from "@/lib/db";

async function main() {
  const rows = await db.$queryRaw<{ id: number; nome: string; base: number; extra: number }[]>`
    SELECT c.id, c.nome,
      SUM(CASE WHEN w.eh_extra = false THEN 1 ELSE 0 END)::int AS base,
      SUM(CASE WHEN w.eh_extra = true  THEN 1 ELSE 0 END)::int AS extra
    FROM clientes c
    LEFT JOIN cliente_crm_webhooks w ON w.cliente_id = c.id
    GROUP BY c.id, c.nome
    ORDER BY c.nome
  `;
  console.log("Cliente                         | base | extra");
  console.log("--------------------------------|------|------");
  for (const r of rows) {
    const ok = r.base === 5 ? "✅" : r.base === 0 ? "  " : "⚠";
    console.log(`${ok} ${r.nome.padEnd(31)}| ${String(r.base).padStart(4)} | ${String(r.extra).padStart(5)}`);
  }
}

main().catch(console.error).finally(() => db.$disconnect());
