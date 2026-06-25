/**
 * Atualiza os IDs do Google Ads no banco via Prisma Client.
 * Executa: node scripts/update-google-ids.mjs
 */
import { readFileSync } from "fs";
import { resolve } from "path";

// Lê o .env.local
const env = Object.fromEntries(
  readFileSync(resolve(process.cwd(), ".env.local"), "utf-8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const [k, ...rest] = l.split("=");
      return [k.trim(), rest.join("=").trim().replace(/^"|"$/g, "")];
    })
);
process.env.DATABASE_URL = env.DATABASE_URL;

// Import dinâmico do Prisma Client gerado
const { PrismaClient } = await import("../node_modules/.prisma/client/index.js");
const prisma = new PrismaClient();

const atualizacoes = [
  // C.R.O LICITAÇÕES
  {
    nomeBusca: ["cro", "licita"],
    googleAdsCustomerId:                 "2473233407",
    googleConversionActionIdQualificado: "7659713037",
    googleConversionActionId:            "7659713160",
  },
  // Caldeiras Santesso
  {
    nomeBusca: ["santesso", "caldeira"],
    googleAdsCustomerId:                 "9498712703",
    googleConversionActionIdQualificado: "7659609268",
    googleConversionActionId:            "7659609781",
  },
  // Dra. Blenda Otorrino
  {
    nomeBusca: ["blenda", "otorrino"],
    googleAdsCustomerId:                 "7562236009",
    googleConversionActionIdQualificado: "7659326576",
    googleConversionActionId:            "7659326579",
  },
  // Elyon Tendas
  {
    nomeBusca: ["elyon", "tenda"],
    googleAdsCustomerId:                 "8503537103",
    googleConversionActionIdQualificado: "7659609802",
    googleConversionActionId:            "7659609805",
  },
];

console.log("Buscando clientes no banco...\n");

const todosClientes = await prisma.cliente.findMany({
  select: { id: true, nome: true, googleAdsCustomerId: true },
});

console.log(`Total de clientes: ${todosClientes.length}`);
todosClientes.forEach((c) =>
  console.log(`  ID ${c.id} — ${c.nome}${c.googleAdsCustomerId ? ` (Google Ads: ${c.googleAdsCustomerId})` : ""}`)
);
console.log();

let atualizados = 0;

for (const upd of atualizacoes) {
  const cliente = todosClientes.find((c) =>
    upd.nomeBusca.some((termo) => c.nome.toLowerCase().includes(termo))
  );

  if (!cliente) {
    console.log(`⚠️  Não encontrou cliente para termos: ${upd.nomeBusca.join(", ")}`);
    continue;
  }

  await prisma.cliente.update({
    where: { id: cliente.id },
    data: {
      googleAdsCustomerId:                upd.googleAdsCustomerId,
      googleConversionActionId:           upd.googleConversionActionId,
      googleConversionActionIdQualificado: upd.googleConversionActionIdQualificado,
    },
  });

  console.log(`✅ "${cliente.nome}" (ID ${cliente.id}) atualizado:`);
  console.log(`   google_ads_customer_id          = ${upd.googleAdsCustomerId}`);
  console.log(`   conversion_action_id_qualificado = ${upd.googleConversionActionIdQualificado}`);
  console.log(`   conversion_action_id (convertido)= ${upd.googleConversionActionId}`);
  atualizados++;
}

await prisma.$disconnect();
console.log(`\n✅ ${atualizados} cliente(s) atualizados com sucesso.`);
