// node migrate-relatorio-analise-ia.cjs  (rodar da pasta raiz do projeto)
// Ver db/026_relatorio_analise_ia.sql
const { PrismaClient } = require("./web/node_modules/@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE relatorios_publicos ADD COLUMN IF NOT EXISTS analise_ia TEXT
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE relatorios_publicos ADD COLUMN IF NOT EXISTS analise_ia_gerado_em TIMESTAMPTZ
  `);
  console.log("✓ analise_ia e analise_ia_gerado_em adicionadas em relatorios_publicos");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
