// node migrate-cliente-perfil.cjs  (rodar da pasta raiz do projeto)
// Ver db/030_cliente_perfil.sql
const { PrismaClient } = require("./web/node_modules/@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS foto_url TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS bio TEXT`);

  await prisma.$executeRawUnsafe(`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS portal_mostrar_dashboard   BOOLEAN NOT NULL DEFAULT false`);
  await prisma.$executeRawUnsafe(`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS portal_mostrar_crm         BOOLEAN NOT NULL DEFAULT false`);
  await prisma.$executeRawUnsafe(`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS portal_mostrar_relatorios  BOOLEAN NOT NULL DEFAULT true`);
  await prisma.$executeRawUnsafe(`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS portal_mostrar_resultados  BOOLEAN NOT NULL DEFAULT false`);
  await prisma.$executeRawUnsafe(`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS portal_mostrar_historico   BOOLEAN NOT NULL DEFAULT false`);
  await prisma.$executeRawUnsafe(`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS portal_mostrar_documentos  BOOLEAN NOT NULL DEFAULT false`);
  await prisma.$executeRawUnsafe(`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS portal_mostrar_faturamento BOOLEAN NOT NULL DEFAULT false`);

  const r1 = await prisma.$executeRawUnsafe(`
    UPDATE clientes c SET portal_mostrar_dashboard = true
    WHERE EXISTS (
      SELECT 1 FROM clientes_ativos ca
      WHERE ca.cliente_id = c.id AND ca.ativo = true
        AND (ca.meta_ad_account_id IS NOT NULL OR ca.google_ad_customer_id IS NOT NULL)
    )
  `);
  const r2 = await prisma.$executeRawUnsafe(`
    UPDATE clientes c SET portal_mostrar_crm = true
    WHERE EXISTS (SELECT 1 FROM cliente_crm_webhooks w WHERE w.cliente_id = c.id)
  `);
  const r3 = await prisma.$executeRawUnsafe(`
    UPDATE clientes c SET portal_mostrar_historico = true
    WHERE EXISTS (
      SELECT 1 FROM cliente_historico h
      WHERE h.cliente_id = c.id AND h.visivel_portal = true
    )
  `);

  console.log("✓ colunas de perfil adicionadas em clientes");
  console.log(`  backfill dashboard: ${r1} clientes, crm: ${r2} clientes, historico: ${r3} clientes`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
