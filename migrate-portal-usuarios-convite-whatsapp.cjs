// node migrate-portal-usuarios-convite-whatsapp.cjs  (rodar da pasta raiz do projeto)
// Ver db/037_portal_usuarios_convite_whatsapp.sql
const { PrismaClient } = require("./web/node_modules/@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`ALTER TABLE portal_usuarios ALTER COLUMN nome DROP NOT NULL`);
  await prisma.$executeRawUnsafe(`ALTER TABLE portal_usuarios ALTER COLUMN email DROP NOT NULL`);
  await prisma.$executeRawUnsafe(`ALTER TABLE portal_usuarios ALTER COLUMN senha_hash DROP NOT NULL`);
  await prisma.$executeRawUnsafe(`ALTER TABLE portal_usuarios ADD COLUMN IF NOT EXISTS telefone TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE portal_usuarios ADD COLUMN IF NOT EXISTS token TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE portal_usuarios ADD COLUMN IF NOT EXISTS token_expira_em TIMESTAMPTZ`);
  console.log("✓ portal_usuarios pronto pro fluxo de convite via WhatsApp");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
