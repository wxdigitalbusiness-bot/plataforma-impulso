import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

const sql = readFileSync(join(__dirname, "../db/029_webhook_origem.sql"), "utf-8");
const statements = sql
  .split(";")
  .map((s) => s.replace(/--.*$/gm, "").trim())
  .filter((s) => s.length > 0);

console.log(`Rodando migration 029_webhook_origem.sql (${statements.length} statements)…\n`);

for (const stmt of statements) {
  try {
    const result = await prisma.$executeRawUnsafe(stmt + ";");
    console.log(`  ✔ ${stmt.slice(0, 80).replace(/\n/g, " ")}… (${result} rows)`);
  } catch (err) {
    console.error(`  ✘ ERRO: ${stmt.slice(0, 80)}`);
    console.error(`    ${err.message}`);
    process.exit(1);
  }
}

await prisma.$disconnect();
console.log("\n✅ Migration 029 aplicada com sucesso.");
