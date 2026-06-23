import { config } from "dotenv";
config({ path: ".env.local", override: true });
import { db } from "@/lib/db";

async function main() {
  const rows = await db.$queryRaw<any[]>`
    SELECT
      lead_id,
      lead_whatsapp,
      lead_nome,
      fase,
      data_criacao::date::text AS data,
      created_at
    FROM fb_leads
    WHERE lower(client_key) = 'festpizza'
      AND data_criacao::date BETWEEN '2026-06-05' AND '2026-06-07'
    ORDER BY data_criacao, created_at
  `;

  console.log(`\nTotal registros no período 05/06–07/06: ${rows.length}`);
  console.log("lead_id".padEnd(20) + " | " + "fone".padEnd(14) + " | " + "fase".padEnd(22) + " | data     | updated_at");
  console.log("-".repeat(100));
  for (const r of rows) {
    const nome = (r.lead_nome || "").substring(0, 18).padEnd(18);
    const id   = String(r.lead_id).padEnd(20);
    const fone = String(r.lead_whatsapp || "").padEnd(14);
    const fase = String(r.fase || "").padEnd(22);
    const ts   = r.created_at?.toISOString().replace("T", " ").substring(0, 19);
    console.log(`${id} | ${fone} | ${fase} | ${r.data} | ${ts}`);
  }

  // Deduplicado como a plataforma faz
  const dedup = await db.$queryRaw<any[]>`
    WITH leads_unicos AS (
      SELECT
        COALESCE(NULLIF(TRIM(lead_whatsapp), ''), lead_id) AS chave,
        (array_agg(fase ORDER BY created_at DESC NULLS LAST))[1] AS fase_atual
      FROM fb_leads
      WHERE lower(client_key) = 'festpizza'
        AND data_criacao::date BETWEEN '2026-06-05' AND '2026-06-07'
      GROUP BY COALESCE(NULLIF(TRIM(lead_whatsapp), ''), lead_id)
    )
    SELECT
      CASE
        WHEN fase_atual IN ('Novo Lead', 'Não classificado', 'Nao classificado') THEN 'Leads'
        ELSE fase_atual
      END AS fase_unificada,
      COUNT(*) AS qtd
    FROM leads_unicos
    WHERE fase_atual IS NOT NULL
    GROUP BY fase_unificada
    ORDER BY COUNT(*) DESC
  `;
  console.log("\n--- Como a plataforma exibe (deduplicado por fone) ---");
  let total = 0;
  for (const r of dedup) {
    console.log(`  ${String(r.fase_unificada).padEnd(25)} ${r.qtd}`);
    total += Number(r.qtd);
  }
  console.log(`  ${"TOTAL".padEnd(25)} ${total}`);
}

main().catch(console.error).finally(() => db.$disconnect());
