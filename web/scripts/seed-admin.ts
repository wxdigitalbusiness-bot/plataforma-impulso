// Cria/atualiza o primeiro usuario admin da plataforma.
// Uso: ADMIN_EMAIL=... ADMIN_SENHA=... ADMIN_NOME=... npx tsx scripts/seed-admin.ts

import { hash } from "bcryptjs";
import { db } from "../src/lib/db";

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const senha = process.env.ADMIN_SENHA;
  const nome = process.env.ADMIN_NOME ?? "Admin";

  if (!email || !senha) {
    console.error("Defina ADMIN_EMAIL e ADMIN_SENHA no ambiente.");
    process.exit(1);
  }

  const senhaHash = await hash(senha, 10);

  const usuario = await db.usuario.upsert({
    where: { email },
    create: { nome, email, senhaHash, ativo: true },
    update: { nome, senhaHash, ativo: true },
  });

  console.log("Usuario admin pronto:", { id: usuario.id, email: usuario.email });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
