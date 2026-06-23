import { readFileSync } from "fs";
import { resolve } from "path";

const env = Object.fromEntries(
  readFileSync(resolve(process.cwd(), ".env.local"), "utf-8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const [k, ...rest] = l.split("="); return [k.trim(), rest.join("=").trim().replace(/^"|"$/g, "")]; })
);
process.env.DATABASE_URL = env.DATABASE_URL;

const { PrismaClient } = await import("../node_modules/.prisma/client/index.js");
const prisma = new PrismaClient();

const clientes = await prisma.cliente.findMany({
  where: { googleAdsCustomerId: { not: null } },
  select: {
    id: true,
    nome: true,
    n8nClientKey: true,
    waNumero: true,
    googleAdsCustomerId: true,
  },
});

console.log("Clientes com Google Ads — chaves e WhatsApp:\n");
clientes.forEach((c) => {
  console.log(`${c.nome} (ID ${c.id})`);
  console.log(`  n8n_client_key  : ${c.n8nClientKey ?? "(vazio)"}`);
  console.log(`  wa_numero       : ${c.waNumero ?? "(vazio)"}`);
  console.log(`  Link de rastreamento:`);
  const base = "https://plataforma.mktimpulso.com.br";
  const slug = c.n8nClientKey ?? "SLUG_AQUI";
  console.log(`  ${base}/r/wa/${slug}?gclid={gclid}`);
  console.log();
});

await prisma.$disconnect();
