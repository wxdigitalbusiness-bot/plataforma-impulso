// node migrate-cliente-documentos-notas.cjs  (rodar da pasta raiz do projeto)
// Ver db/035_cliente_documentos_notas.sql
const { PrismaClient } = require("./web/node_modules/@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`ALTER TABLE cliente_documentos ALTER COLUMN url DROP NOT NULL`);
  await prisma.$executeRawUnsafe(`ALTER TABLE cliente_documentos ALTER COLUMN tamanho DROP NOT NULL`);
  await prisma.$executeRawUnsafe(`ALTER TABLE cliente_documentos ADD COLUMN IF NOT EXISTS conteudo TEXT`);
  console.log("✓ cliente_documentos: url/tamanho opcionais, coluna conteudo adicionada");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
