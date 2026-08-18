// node migrate-fb-leads-nova-mensagem.cjs  (rodar da pasta raiz do projeto)
// Ver db/033_fb_leads_nova_mensagem.sql
const { PrismaClient } = require("./web/node_modules/@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE fb_leads ADD COLUMN IF NOT EXISTS nova_mensagem BOOLEAN NOT NULL DEFAULT false
  `);
  console.log("✓ coluna nova_mensagem adicionada em fb_leads");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
