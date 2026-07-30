// node migrate-etapas-posicao.cjs  (rodar da pasta raiz do projeto)
// Ver db/025_etapas_posicao.sql
const { PrismaClient } = require("./web/node_modules/@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE cliente_crm_webhooks ADD COLUMN IF NOT EXISTS posicao INTEGER
  `);

  await prisma.$executeRawUnsafe(`
    WITH ordenado AS (
      SELECT id, ROW_NUMBER() OVER (
        PARTITION BY cliente_id
        ORDER BY eh_extra ASC, criado_em ASC
      ) AS rn
      FROM cliente_crm_webhooks
    )
    UPDATE cliente_crm_webhooks w
    SET posicao = ordenado.rn
    FROM ordenado
    WHERE w.id = ordenado.id AND w.posicao IS NULL
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE cliente_crm_webhooks ALTER COLUMN posicao SET NOT NULL
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE cliente_crm_webhooks ALTER COLUMN posicao SET DEFAULT 0
  `);

  console.log("✓ posicao adicionada e preenchida em cliente_crm_webhooks");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
