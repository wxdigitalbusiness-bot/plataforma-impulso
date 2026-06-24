import { readFileSync } from "fs";
import { resolve } from "path";

const env = Object.fromEntries(
  readFileSync(resolve(process.cwd(), ".env.local"), "utf-8")
    .split("\n").filter(l => l.includes("=") && !l.startsWith("#"))
    .map(l => { const [k, ...v] = l.split("="); return [k.trim(), v.join("=").trim().replace(/^"|"$/g, "")]; })
);
process.env.DATABASE_URL = env.DATABASE_URL;

const { PrismaClient } = await import("../node_modules/.prisma/client/index.js");
const prisma = new PrismaClient();

const cols = await prisma.$queryRaw`
  SELECT ordinal_position, column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_name = 'fb_leads'
  ORDER BY ordinal_position
`;

console.log("\n=== Colunas de fb_leads ===\n");
console.log("Pos | Nome                     | Tipo            | Nullable | Default");
console.log("-".repeat(85));
for (const c of cols) {
  const pos  = String(c.ordinal_position).padEnd(3);
  const nome = c.column_name.padEnd(24);
  const tipo = c.data_type.padEnd(15);
  const nul  = c.is_nullable === "YES" ? "YES     " : "NO      ";
  const def  = c.column_default ?? "(nenhum)";
  console.log(`${pos} | ${nome} | ${tipo} | ${nul} | ${def}`);
}

await prisma.$disconnect();
