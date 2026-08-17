// node migrate-relatorio-resultados-origem.cjs  (rodar da pasta raiz do projeto)
// Ver db/029_relatorio_resultados_origem.sql
const { PrismaClient } = require("./web/node_modules/@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE relatorios_publicos ADD COLUMN IF NOT EXISTS resultados_origem TEXT NOT NULL DEFAULT 'todos'
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE relatorios_publicos DROP CONSTRAINT IF EXISTS relatorios_publicos_resultados_origem_check
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE relatorios_publicos ADD CONSTRAINT relatorios_publicos_resultados_origem_check
      CHECK (resultados_origem IN ('todos', 'pago', 'organico'))
  `);
  console.log("✓ resultados_origem adicionada em relatorios_publicos");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
