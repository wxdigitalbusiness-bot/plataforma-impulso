/**
 * Cria "CRM - Lead Qualificado" e "CRM - Lead Convertido" no Google Ads
 * para cada sub-conta do MCC e atualiza o banco de dados do CRM.
 */
import { readFileSync } from "fs";
import { resolve } from "path";

const env = Object.fromEntries(
  readFileSync(resolve(process.cwd(), ".env.local"), "utf-8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const [k, ...rest] = l.split("="); return [k.trim(), rest.join("=").trim().replace(/^"|"$/g, "")]; })
);

const mccId = env.GOOGLE_ADS_MCC_ID.replace(/-/g, "");
const devToken = env.GOOGLE_ADS_DEVELOPER_TOKEN;
const dbUrl = env.DATABASE_URL;

// ── 1. Access token ────────────────────────────────────────────────────────
const { access_token } = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    client_id:     env.GOOGLE_ADS_CLIENT_ID,
    client_secret: env.GOOGLE_ADS_CLIENT_SECRET,
    refresh_token: env.GOOGLE_ADS_REFRESH_TOKEN,
    grant_type:    "refresh_token",
  }),
}).then(r => r.json());

console.log("✅ Access token OK\n");

const gadsHeaders = (customerId) => ({
  Authorization:       `Bearer ${access_token}`,
  "developer-token":   devToken,
  "login-customer-id": mccId,
  "Content-Type":      "application/json",
});

// ── 2. Sub-contas do MCC ───────────────────────────────────────────────────
const subContasRes = await fetch(
  `https://googleads.googleapis.com/v24/customers/${mccId}/googleAds:searchStream`,
  {
    method: "POST",
    headers: gadsHeaders(mccId),
    body: JSON.stringify({
      query: "SELECT customer_client.id, customer_client.descriptive_name FROM customer_client WHERE customer_client.level = 1 LIMIT 20",
    }),
  }
).then(r => r.json());

const subContas = (subContasRes ?? [])
  .flatMap(r => r.results ?? [])
  .map(r => ({ id: String(r.customerClient.id), nome: r.customerClient.descriptiveName }));

console.log(`Contas encontradas: ${subContas.map(c => c.nome).join(", ")}\n`);

// ── 3. Cria conversões em cada conta ───────────────────────────────────────
const resultados = [];

for (const conta of subContas) {
  console.log(`\n── ${conta.nome} (${conta.id}) ──────────────────────────`);

  // Verifica se já existem conversões CRM para evitar duplicatas
  const existentesRes = await fetch(
    `https://googleads.googleapis.com/v24/customers/${conta.id}/googleAds:searchStream`,
    {
      method: "POST",
      headers: gadsHeaders(conta.id),
      body: JSON.stringify({
        query: `SELECT conversion_action.id, conversion_action.name FROM conversion_action WHERE conversion_action.name LIKE 'CRM -%' AND conversion_action.status != 'REMOVED'`,
      }),
    }
  ).then(r => r.json());

  const existentes = (existentesRes ?? []).flatMap(r => r.results ?? [])
    .map(r => ({ id: String(r.conversionAction.id), nome: r.conversionAction.name }));

  if (existentes.length > 0) {
    console.log(`  ⚠️  Já existem conversões CRM: ${existentes.map(e => `"${e.nome}" (${e.id})`).join(", ")}`);
  }

  const jaTemQualificado = existentes.find(e => e.nome.includes("Qualificado"));
  const jaTemConvertido  = existentes.find(e => e.nome.includes("Convertido"));

  let idQualificado = jaTemQualificado?.id ?? null;
  let idConvertido  = jaTemConvertido?.id ?? null;

  const operacoes = [];
  if (!jaTemQualificado) operacoes.push({
    create: {
      name:                           "CRM - Lead Qualificado",
      type:                           "UPLOAD_CLICKS",
      status:                         "ENABLED",
      category:                       "QUALIFIED_LEAD",
      countingType:                   "ONE_PER_CLICK",
      clickThroughLookbackWindowDays: 90,
    },
  });
  if (!jaTemConvertido) operacoes.push({
    create: {
      name:                           "CRM - Lead Convertido",
      type:                           "UPLOAD_CLICKS",
      status:                         "ENABLED",
      category:                       "CONVERTED_LEAD",
      countingType:                   "ONE_PER_CLICK",
      clickThroughLookbackWindowDays: 90,
    },
  });

  if (operacoes.length > 0) {
    const mutateRes = await fetch(
      `https://googleads.googleapis.com/v24/customers/${conta.id}/conversionActions:mutate`,
      {
        method: "POST",
        headers: gadsHeaders(conta.id),
        body: JSON.stringify({ operations: operacoes }),
      }
    ).then(r => r.json());

    if (mutateRes.error) {
      console.log(`  ❌ Erro ao criar: ${JSON.stringify(mutateRes.error.message)}`);
      continue;
    }

    const criados = mutateRes.results ?? [];
    for (const r of criados) {
      // resourceName: "customers/XXXXX/conversionActions/YYYYY"
      const numId = r.resourceName?.split("/").pop();
      // Descobre qual foi pelo índice da operação
      const nomeOp = operacoes[criados.indexOf(r)]?.create?.name ?? "";
      if (nomeOp.includes("Qualificado")) idQualificado = numId;
      if (nomeOp.includes("Convertido"))  idConvertido  = numId;
      console.log(`  ✅ Criado: "${nomeOp}" → ID ${numId}`);
    }
  } else {
    console.log("  ℹ️  Usando IDs já existentes");
  }

  resultados.push({
    googleAdsNome:        conta.nome,
    googleAdsCustomerId:  conta.id,
    idQualificado,
    idConvertido,
  });
}

// ── 4. Atualiza o banco ────────────────────────────────────────────────────
console.log("\n\n── Atualizando banco de dados ──────────────────────────────");

// Usa pg direto (sem Prisma) para não precisar compilar TS
const { default: pg } = await import("pg");
const { Client } = pg;
const client = new Client({ connectionString: dbUrl });
await client.connect();

// Busca todos os clientes com google_ads_customer_id ou que o nome bate
const { rows: todosClientes } = await client.query(
  `SELECT id, nome, google_ads_customer_id FROM clientes ORDER BY id`
);

let atualizados = 0;

for (const resultado of resultados) {
  // Tenta achar por customer_id já cadastrado, ou por nome aproximado
  const crmCliente = todosClientes.find(c =>
    c.google_ads_customer_id === resultado.googleAdsCustomerId ||
    c.nome.toLowerCase().includes(resultado.googleAdsNome.toLowerCase().split(" ")[0]) ||
    resultado.googleAdsNome.toLowerCase().includes(c.nome.toLowerCase().split(" ")[0])
  );

  if (!crmCliente) {
    console.log(`  ⚠️  Não encontrou cliente CRM para "${resultado.googleAdsNome}" — pule ou adicione manualmente`);
    continue;
  }

  await client.query(
    `UPDATE clientes SET
       google_ads_customer_id                   = $1,
       google_conversion_action_id              = $2,
       google_conversion_action_id_qualificado  = $3
     WHERE id = $4`,
    [resultado.googleAdsCustomerId, resultado.idConvertido, resultado.idQualificado, crmCliente.id]
  );

  console.log(`  ✅ Cliente "${crmCliente.nome}" (ID ${crmCliente.id}) atualizado:`);
  console.log(`     google_ads_customer_id          = ${resultado.googleAdsCustomerId}`);
  console.log(`     conversion_action_id_qualificado= ${resultado.idQualificado}`);
  console.log(`     conversion_action_id (convertido)= ${resultado.idConvertido}`);
  atualizados++;
}

await client.end();
console.log(`\n✅ ${atualizados} cliente(s) atualizados no banco.`);
console.log("\nResultado final:");
console.table(resultados);
