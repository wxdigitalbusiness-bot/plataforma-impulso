import { readFileSync } from "fs";
import { resolve } from "path";

const env = Object.fromEntries(
  readFileSync(resolve(process.cwd(), ".env.local"), "utf-8")
    .split("\n").filter(l => l.includes("=") && !l.startsWith("#"))
    .map(l => { const [k,...v] = l.split("="); return [k.trim(), v.join("=").trim()]; })
);
process.env.DATABASE_URL = env.DATABASE_URL;

const { PrismaClient } = await import("../node_modules/.prisma/client/index.js");
const prisma = new PrismaClient();

const clientes = await prisma.cliente.findMany({
  select: { id: true, nome: true, evolutionInstance: true, n8nClientKey: true, ativo: true },
  orderBy: { id: "asc" },
});

console.log("Cliente ID | Nome                    | Evolution Instance       | Key          | Ativo");
console.log("-".repeat(95));
clientes.forEach(c => {
  const inst = c.evolutionInstance ?? "(não configurado)";
  const key  = c.n8nClientKey ?? "(vazio)";
  console.log(`${String(c.id).padEnd(10)} | ${c.nome.padEnd(23)} | ${inst.padEnd(24)} | ${key.padEnd(12)} | ${c.ativo}`);
});

await prisma.$disconnect();
