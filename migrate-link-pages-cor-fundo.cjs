// node migrate-link-pages-cor-fundo.cjs  (rodar da pasta raiz do projeto)
// Ver db/039_link_pages_cor_fundo.sql
const { PrismaClient } = require("./web/node_modules/@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE link_pages ADD COLUMN IF NOT EXISTS cor_fundo TEXT
  `);
  console.log("✓ link_pages.cor_fundo criada");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
