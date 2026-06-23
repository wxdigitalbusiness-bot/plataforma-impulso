import { config } from "dotenv";
config({ path: ".env.local", override: true });
import { db } from "@/lib/db";

async function main() {
  const r1 = await db.$executeRaw`
    UPDATE fb_leads
    SET data_criacao = '2026-06-04 21:40:06'::timestamptz
    WHERE lower(client_key) = 'festpizza'
      AND TRIM(lead_whatsapp) = '6384433912'
  `;
  console.log(`6384433912 → data_criacao=04/06: ${r1} linha(s)`);

  const r2 = await db.$executeRaw`
    UPDATE fb_leads
    SET data_criacao = '2026-06-04 22:04:41'::timestamptz
    WHERE lower(client_key) = 'festpizza'
      AND TRIM(lead_whatsapp) = '6392399372'
  `;
  console.log(`6392399372 → data_criacao=04/06: ${r2} linha(s)`);

  // Resultado 05/06–07/06
  const res = await db.$queryRaw<any[]>`
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
      CASE WHEN fase_atual IN ('Novo Lead','Não classificado','Nao classificado') THEN 'Leads'
           ELSE fase_atual END AS fase,
      COUNT(*) AS qtd
    FROM leads_unicos WHERE fase_atual IS NOT NULL
    GROUP BY 1 ORDER BY 2 DESC
  `;
  let total = 0;
  console.log("\n--- Plataforma 05/06–07/06 após correção ---");
  res.forEach(r => { console.log(`  ${String(r.fase).padEnd(25)} ${r.qtd}`); total += Number(r.qtd); });
  console.log(`  ${"TOTAL".padEnd(25)} ${total}`);

  // Resultado 04/06–06/06 (pra não quebrar período anterior)
  const res2 = await db.$queryRaw<any[]>`
    WITH leads_unicos AS (
      SELECT
        COALESCE(NULLIF(TRIM(lead_whatsapp), ''), lead_id) AS chave,
        (array_agg(fase ORDER BY created_at DESC NULLS LAST))[1] AS fase_atual
      FROM fb_leads
      WHERE lower(client_key) = 'festpizza'
        AND data_criacao::date BETWEEN '2026-06-04' AND '2026-06-06'
      GROUP BY COALESCE(NULLIF(TRIM(lead_whatsapp), ''), lead_id)
    )
    SELECT
      CASE WHEN fase_atual IN ('Novo Lead','Não classificado','Nao classificado') THEN 'Leads'
           ELSE fase_atual END AS fase,
      COUNT(*) AS qtd
    FROM leads_unicos WHERE fase_atual IS NOT NULL
    GROUP BY 1 ORDER BY 2 DESC
  `;
  let total2 = 0;
  console.log("\n--- Plataforma 04/06–06/06 (conferência) ---");
  res2.forEach(r => { console.log(`  ${String(r.fase).padEnd(25)} ${r.qtd}`); total2 += Number(r.qtd); });
  console.log(`  ${"TOTAL".padEnd(25)} ${total2}`);
}

main().catch(console.error).finally(() => db.$disconnect());
