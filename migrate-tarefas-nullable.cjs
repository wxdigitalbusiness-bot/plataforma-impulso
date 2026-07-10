// node migrate-tarefas-nullable.cjs  (rodar da pasta web/)
const { PrismaClient } = require("./web/node_modules/@prisma/client");
const prisma = new PrismaClient();

async function main() {
  // cliente_id opcional em projetos
  await prisma.$executeRawUnsafe(`
    ALTER TABLE crm_projetos ALTER COLUMN cliente_id DROP NOT NULL
  `);

  // projeto_id opcional em tarefas + FK passa a SET NULL ao deletar projeto
  await prisma.$executeRawUnsafe(`
    ALTER TABLE crm_tarefas ALTER COLUMN projeto_id DROP NOT NULL
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE crm_tarefas DROP CONSTRAINT IF EXISTS crm_tarefas_projeto_id_fkey
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE crm_tarefas ADD CONSTRAINT crm_tarefas_projeto_id_fkey
      FOREIGN KEY (projeto_id) REFERENCES crm_projetos(id) ON DELETE SET NULL
  `);

  console.log("✓ colunas nullable, FK atualizada para SET NULL");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
