import { config } from "dotenv";
config({ path: ".env.local", override: true });
import { db } from "@/lib/db";

async function main() {
  // Todos os leads da Dra. Blenda, sem filtro de data, pra ver tudo
  const todos = await db.$queryRaw<any[]>`
    SELECT
      lead_id,
      lead_whatsapp,
      lead_nome,
      fase,
      data_criacao::date::text AS data,
      created_at
    FROM fb_leads
    WHERE lower(client_key) = 'drablendaotorrino'
    ORDER BY data_criacao DESC, created_at DESC
    LIMIT 30
  `;

  console.log(`Total registros (últimos 30): ${todos.length}`);
  console.log("fone".padEnd(15) + " | " + "fase".padEnd(25) + " | data_criacao | updated_at");
  console.log("-".repeat(85));
  for (const r of todos) {
    const fone = String(r.lead_whatsapp || "").padEnd(15);
    const fase = String(r.fase || "").padEnd(25);
    const ts   = r.created_at?.toISOString().replace("T", " ").substring(0, 19);
    console.log(`${fone} | ${fase} | ${r.data}     | ${ts}`);
  }
}

main().catch(console.error).finally(() => db.$disconnect());
