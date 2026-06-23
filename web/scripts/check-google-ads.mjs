import { readFileSync } from "fs";
import { resolve } from "path";

const envPath = resolve(process.cwd(), ".env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf-8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const [k, ...rest] = l.split("=");
      return [k.trim(), rest.join("=").trim().replace(/^"|"$/g, "")];
    })
);

const {
  GOOGLE_ADS_CLIENT_ID,
  GOOGLE_ADS_CLIENT_SECRET,
  GOOGLE_ADS_REFRESH_TOKEN,
  GOOGLE_ADS_DEVELOPER_TOKEN,
  GOOGLE_ADS_MCC_ID,
} = env;

console.log("\n── Credenciais carregadas ──────────────────────────────");
console.log(`  client_id      : ${GOOGLE_ADS_CLIENT_ID?.slice(0, 20)}…`);
console.log(`  developer_token: ${GOOGLE_ADS_DEVELOPER_TOKEN}`);
console.log(`  mcc_id         : ${GOOGLE_ADS_MCC_ID}`);

// 1. Obter access token
console.log("\n── Testando OAuth (refresh → access token) ─────────────");
const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    client_id:     GOOGLE_ADS_CLIENT_ID,
    client_secret: GOOGLE_ADS_CLIENT_SECRET,
    refresh_token: GOOGLE_ADS_REFRESH_TOKEN,
    grant_type:    "refresh_token",
  }),
});
const tokenData = await tokenRes.json();
if (!tokenData.access_token) {
  console.log("❌ OAuth falhou:", JSON.stringify(tokenData));
  process.exit(1);
}
console.log("✅ Access token obtido com sucesso");

// 2. Listar contas acessíveis (v24, sem login-customer-id)
console.log("\n── Testando listAccessibleCustomers (v24) ──────────────");
const mccId = GOOGLE_ADS_MCC_ID.replace(/-/g, "");

const listRes = await fetch(
  `https://googleads.googleapis.com/v24/customers:listAccessibleCustomers`,
  {
    headers: {
      Authorization:     `Bearer ${tokenData.access_token}`,
      "developer-token": GOOGLE_ADS_DEVELOPER_TOKEN,
    },
  }
);
const listJson = await listRes.json();
if (!listRes.ok) {
  console.log(`❌ HTTP ${listRes.status}:`, JSON.stringify(listJson, null, 2));
  process.exit(1);
}
const contas = listJson.resourceNames ?? [];
console.log(`✅ Contas acessíveis (${contas.length}):\n${contas.map(n => "  " + n).join("\n") || "  (nenhuma)"}`);

// 3. Busca detalhes das sub-contas do MCC
console.log("\n── Buscando sub-contas do MCC via searchStream ─────────");
const searchRes = await fetch(
  `https://googleads.googleapis.com/v24/customers/${mccId}/googleAds:searchStream`,
  {
    method: "POST",
    headers: {
      Authorization:       `Bearer ${tokenData.access_token}`,
      "developer-token":   GOOGLE_ADS_DEVELOPER_TOKEN,
      "login-customer-id": mccId,
      "Content-Type":      "application/json",
    },
    body: JSON.stringify({
      query: "SELECT customer_client.id, customer_client.descriptive_name, customer_client.level FROM customer_client WHERE customer_client.level <= 1 LIMIT 20",
    }),
  }
);
const searchText = await searchRes.text();
let searchJson;
try { searchJson = JSON.parse(searchText); } catch { searchJson = null; }

if (!searchRes.ok || !searchJson) {
  console.log(`❌ HTTP ${searchRes.status}: ${searchText.slice(0, 300)}`);
} else {
  const clientes = (searchJson ?? [])
    .flatMap(r => r.results ?? [])
    .map(r => `  [L${r.customerClient?.level}] ${r.customerClient?.id} — ${r.customerClient?.descriptiveName}`);
  console.log(`✅ Sub-contas encontradas:\n${clientes.join("\n") || "  (nenhuma)"}`);
}
