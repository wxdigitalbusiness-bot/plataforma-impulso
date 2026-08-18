// node migrate-cliente-faturas.cjs  (rodar da pasta raiz do projeto)
// Ver db/032_cliente_faturas.sql
const { PrismaClient } = require("./web/node_modules/@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS cliente_faturas (
      id            BIGSERIAL PRIMARY KEY,
      cliente_id    INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
      descricao     TEXT NOT NULL,
      valor         DECIMAL(12,2) NOT NULL,
      vencimento    DATE NOT NULL,
      pago          BOOLEAN NOT NULL DEFAULT false,
      pago_em       TIMESTAMPTZ,
      criado_por    TEXT,
      criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_cliente_faturas_cliente
      ON cliente_faturas (cliente_id, vencimento DESC)
  `);

  console.log("✓ tabela cliente_faturas criada");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
