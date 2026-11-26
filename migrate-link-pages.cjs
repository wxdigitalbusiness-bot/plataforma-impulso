// node migrate-link-pages.cjs  (rodar da pasta raiz do projeto)
// Ver db/038_link_pages.sql
const { PrismaClient } = require("./web/node_modules/@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS link_pages (
      id            SERIAL PRIMARY KEY,
      slug          TEXT NOT NULL UNIQUE,
      nome          TEXT NOT NULL,
      cliente_id    INT REFERENCES clientes(id) ON DELETE SET NULL,
      titulo        TEXT,
      bio           TEXT,
      foto_url      TEXT,
      links         JSONB NOT NULL DEFAULT '[]'::jsonb,
      ativo         BOOLEAN NOT NULL DEFAULT true,
      criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_link_pages_cliente ON link_pages (cliente_id)
  `);
  console.log("✓ link_pages criada");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
