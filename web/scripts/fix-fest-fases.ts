import { config } from "dotenv";
config({ path: ".env.local", override: true });
import { db } from "@/lib/db";

async function main() {
  // 1. 6399982400 → Não classificado
  const r1 = await db.$executeRaw`
    UPDATE fb_leads
    SET fase = 'Não classificado', created_at = now()
    WHERE lower(client_key) = 'festpizza'
      AND TRIM(lead_whatsapp) = '6399982400'
  `;
  console.log(`6399982400 → Não classificado: ${r1} linha(s) atualizada(s)`);

  // 2. 21967570311 → Em Negociação
  const r2 = await db.$executeRaw`
    UPDATE fb_leads
    SET fase = 'Em Negociação', created_at = now()
    WHERE lower(client_key) = 'festpizza'
      AND TRIM(lead_whatsapp) = '21967570311'
  `;
  console.log(`21967570311 → Em Negociação: ${r2} linha(s) atualizada(s)`);

  // Conferir resultado final
  const resultado = await db.$queryRaw<any[]>`
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

  console.log("\n--- Plataforma agora mostra (05/06–07/06) ---");
  let total = 0;
  for (const r of resultado) {
    console.log(`  ${String(r.fase_unificada).padEnd(25)} ${r.qtd}`);
    total += Number(r.qtd);
  }
  console.log(`  ${"TOTAL".padEnd(25)} ${total}`);
}

main().catch(console.error).finally(() => db.$disconnect());
