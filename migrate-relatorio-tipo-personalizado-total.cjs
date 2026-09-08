// node migrate-relatorio-tipo-personalizado-total.cjs  (rodar da pasta raiz do projeto)
// Ver db/034_relatorio_tipo_personalizado_total.sql
const { PrismaClient } = require("./web/node_modules/@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE relatorios_publicos DROP CONSTRAINT IF EXISTS relatorios_publicos_tipo_check
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE relatorios_publicos ADD CONSTRAINT relatorios_publicos_tipo_check
      CHECK (tipo IN ('semanal', 'quinzenal', 'mensal', 'personalizado', 'total'))
  `);
  console.log("✓ constraint relatorios_publicos_tipo_check atualizada (+personalizado, +total)");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
