// node migrate-historico.cjs  (rodar da pasta raiz do projeto)
// Cria cliente_historico — ver db/024_cliente_historico.sql
const { PrismaClient } = require("./web/node_modules/@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS cliente_historico (
      id             SERIAL       PRIMARY KEY,
      cliente_id     INTEGER      NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
      tipo           TEXT         NOT NULL DEFAULT 'interno',
      titulo         TEXT         NOT NULL,
      descricao      TEXT,
      data_acao      DATE         NOT NULL DEFAULT CURRENT_DATE,
      autor          TEXT,
      visivel_portal BOOLEAN      NOT NULL DEFAULT false,
      criado_em      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      atualizado_em  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_cliente_historico_cliente
      ON cliente_historico (cliente_id, data_acao DESC, id DESC)
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_cliente_historico_portal
      ON cliente_historico (cliente_id, visivel_portal, data_acao DESC)
  `);

  console.log("✓ cliente_historico criada (ou já existia)");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
