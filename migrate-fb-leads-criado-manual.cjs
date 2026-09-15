// node migrate-fb-leads-criado-manual.cjs  (rodar da pasta raiz do projeto)
// Ver db/036_fb_leads_criado_manual.sql
const { PrismaClient } = require("./web/node_modules/@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE fb_leads ADD COLUMN IF NOT EXISTS criado_manual BOOLEAN NOT NULL DEFAULT false
  `);
  console.log("✓ criado_manual adicionada em fb_leads");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
