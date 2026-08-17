// node migrate-cliente-documentos.cjs  (rodar da pasta raiz do projeto)
// Ver db/031_cliente_documentos.sql
const { PrismaClient } = require("./web/node_modules/@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS cliente_documentos (
      id            BIGSERIAL PRIMARY KEY,
      cliente_id    INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
      nome          TEXT NOT NULL,
      url           TEXT NOT NULL,
      tamanho       INTEGER NOT NULL,
      tipo          TEXT NOT NULL,
      enviado_por   TEXT,
      criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_cliente_documentos_cliente
      ON cliente_documentos (cliente_id, criado_em DESC)
  `);

  console.log("✓ tabela cliente_documentos criada");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
