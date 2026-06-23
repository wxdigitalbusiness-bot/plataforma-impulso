import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

const rows = await p.$queryRawUnsafe(`
  SELECT table_name, column_name
  FROM information_schema.columns
  WHERE table_name IN ('fb_leads', 'clientes', 'crm_mensagens')
    AND column_name IN ('ctwa_clid', 'source_app', 'evolution_instance', 'pixel_id', 'capi_token', 'id')
  ORDER BY table_name, column_name
`);

console.log("\nColunas CRM no banco:\n");
for (const r of rows) {
  console.log(`  ✔ ${r.table_name}.${r.column_name}`);
}

const crm = await p.$queryRawUnsafe(
  "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'crm_mensagens') AS existe"
);
console.log(`\n  Tabela crm_mensagens existe: ${crm[0].existe}`);

await p.$disconnect();
