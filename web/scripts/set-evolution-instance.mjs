import { readFileSync } from "fs";
import { resolve } from "path";

const env = Object.fromEntries(
  readFileSync(resolve(process.cwd(), ".env.local"), "utf-8")
    .split("\n").filter(l => l.includes("=") && !l.startsWith("#"))
    .map(l => { const [k, ...v] = l.split("="); return [k.trim(), v.join("=").trim()]; })
);
process.env.DATABASE_URL = env.DATABASE_URL;

const { PrismaClient } = await import("../node_modules/.prisma/client/index.js");
const prisma = new PrismaClient();

const updated = await prisma.cliente.update({
  where: { id: 13 },
  data: { evolutionInstance: "IMPULSO" },
  select: { id: true, nome: true, evolutionInstance: true, n8nClientKey: true },
});

console.log("✅ Atualizado:", updated);
await prisma.$disconnect();
