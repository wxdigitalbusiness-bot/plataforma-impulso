// node migrate-relatorio-mostrar-resultados.cjs  (rodar da pasta raiz do projeto)
// Ver db/028_relatorio_mostrar_resultados.sql
const { PrismaClient } = require("./web/node_modules/@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE relatorios_publicos ADD COLUMN IF NOT EXISTS mostrar_resultados BOOLEAN NOT NULL DEFAULT false
  `);
  console.log("✓ mostrar_resultados adicionada em relatorios_publicos");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
