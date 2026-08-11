// node migrate-fb-leads-colaborador.cjs  (rodar da pasta raiz do projeto)
// Ver db/027_fb_leads_colaborador.sql
const { PrismaClient } = require("./web/node_modules/@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE fb_leads ADD COLUMN IF NOT EXISTS eh_colaborador BOOLEAN NOT NULL DEFAULT false
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_fb_leads_colaborador
      ON fb_leads (client_key, eh_colaborador)
      WHERE eh_colaborador = true
  `);
  console.log("✓ eh_colaborador adicionada em fb_leads");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
