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
    googleAdsCustomerId: true,
    googleConversionActionId: true,
    googleConversionActionIdQualificado: true,
  },
});

console.log("Clientes com Google Ads configurado:\n");
clientes.forEach((c) => {
  console.log(`${c.nome} (ID ${c.id})`);
  console.log(`  Customer ID       : ${c.googleAdsCustomerId}`);
  console.log(`  Qualificado ID    : ${c.googleConversionActionIdQualificado}`);
  console.log(`  Convertido ID     : ${c.googleConversionActionId}`);
  console.log();
});

await prisma.$disconnect();
