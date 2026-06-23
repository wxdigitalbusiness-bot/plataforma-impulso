// Script temporário para rodar as migrations do CRM
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbDir = join(__dirname, "../../db");

const prisma = new PrismaClient();

async function runMigration(file) {
  const sql = readFileSync(join(dbDir, file), "utf-8");
  // Remove comentários de linha e divide por ; para rodar cada statement
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  for (const stmt of statements) {
    try {
      await prisma.$executeRawUnsafe(stmt + ";");
      console.log(`  ✔ OK: ${stmt.slice(0, 60).replace(/\n/g, " ")}…`);
    } catch (err) {
      console.error(`  ✘ ERRO: ${stmt.slice(0, 80)}`);
      console.error(`    ${err.message}`);
      throw err;
    }
  }
}

const migrations = [
  "021_fb_leads_capi.sql",
  "022_cliente_capi_config.sql",
  "023_crm_mensagens.sql",
];

console.log("Iniciando migrations CRM…\n");

for (const file of migrations) {
  console.log(`▶ ${file}`);
  await runMigration(file);
  console.log(`  └─ Concluído\n`);
}

await prisma.$disconnect();
console.log("✅ Todas as migrations aplicadas com sucesso.");
