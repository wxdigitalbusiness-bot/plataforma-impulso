/**
 * Lista todas as Conversion Actions de cada sub-conta do MCC.
 * Uso: node scripts/list-conversion-actions.mjs
 */
import { readFileSync } from "fs";
import { resolve } from "path";

const env = Object.fromEntries(
  readFileSync(resolve(process.cwd(), ".env.local"), "utf-8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const [k, ...rest] = l.split("="); return [k.trim(), rest.join("=").trim().replace(/^"|"$/g, "")]; })
);

// Obtém access token
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

const mccId = env.GOOGLE_ADS_MCC_ID.replace(/-/g, "");

// Busca sub-contas do MCC
const subContasRes = await fetch(
  `https://googleads.googleapis.com/v24/customers/${mccId}/googleAds:searchStream`,
  {
    method: "POST",
    headers: {
      Authorization:       `Bearer ${access_token}`,
      "developer-token":   env.GOOGLE_ADS_DEVELOPER_TOKEN,
      "login-customer-id": mccId,
      "Content-Type":      "application/json",
    },
    body: JSON.stringify({
      query: "SELECT customer_client.id, customer_client.descriptive_name FROM customer_client WHERE customer_client.level = 1 LIMIT 20",
    }),
  }
).then(r => r.json());

const subContas = (subContasRes ?? [])
  .flatMap(r => r.results ?? [])
  .map(r => ({ id: r.customerClient.id, nome: r.customerClient.descriptiveName }));

console.log(`\nMCC: ${mccId} — ${subContas.length} sub-conta(s)\n`);

for (const conta of subContas) {
  console.log(`\n══ ${conta.nome} (Customer ID: ${conta.id}) ══════════════`);

  const convRes = await fetch(
    `https://googleads.googleapis.com/v24/customers/${conta.id}/googleAds:searchStream`,
    {
      method: "POST",
      headers: {
        Authorization:       `Bearer ${access_token}`,
        "developer-token":   env.GOOGLE_ADS_DEVELOPER_TOKEN,
        "login-customer-id": mccId,
        "Content-Type":      "application/json",
      },
      body: JSON.stringify({
        query: `
          SELECT
            conversion_action.id,
            conversion_action.name,
            conversion_action.status,
            conversion_action.type,
            conversion_action.tag_snippets
          FROM conversion_action
          WHERE conversion_action.status != 'REMOVED'
        `,
      }),
    }
  ).then(r => r.json());

  const conversions = (convRes ?? []).flatMap(r => r.results ?? []);

  if (conversions.length === 0) {
    console.log("  (nenhuma conversão encontrada)");
    continue;
  }

  for (const c of conversions) {
    const ca = c.conversionAction;
    const label = ca.tagSnippets?.[0]?.eventSnippet?.match(/'send_to':\s*'[^/]+\/([^']+)'/)?.[1] ?? "—";
    console.log(`  ID: ${ca.id}  |  Nome: ${ca.name}  |  Status: ${ca.status}  |  Rótulo: ${label}`);
  }
}
