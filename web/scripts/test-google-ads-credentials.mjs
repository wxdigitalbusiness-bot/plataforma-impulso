// Test Google Ads API credentials end-to-end.
// Reads from .env.local (no secrets passed via CLI).
// Run from `web/` dir: `node --env-file=.env.local scripts/test-google-ads-credentials.mjs`

const required = [
  "GOOGLE_ADS_CLIENT_ID",
  "GOOGLE_ADS_CLIENT_SECRET",
  "GOOGLE_ADS_REFRESH_TOKEN",
  "GOOGLE_ADS_DEVELOPER_TOKEN",
  "GOOGLE_ADS_MCC_ID",
];

const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error("Missing env vars:", missing.join(", "));
  process.exit(1);
}

const {
  GOOGLE_ADS_CLIENT_ID,
  GOOGLE_ADS_CLIENT_SECRET,
  GOOGLE_ADS_REFRESH_TOKEN,
  GOOGLE_ADS_DEVELOPER_TOKEN,
  GOOGLE_ADS_MCC_ID,
} = process.env;

console.log("Step 1: refresh_token -> access_token");
const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    client_id: GOOGLE_ADS_CLIENT_ID,
    client_secret: GOOGLE_ADS_CLIENT_SECRET,
    refresh_token: GOOGLE_ADS_REFRESH_TOKEN,
    grant_type: "refresh_token",
  }),
});
const tokenData = await tokenRes.json();
if (!tokenRes.ok) {
  console.error("FAIL OAuth exchange:", tokenData);
  process.exit(2);
}
console.log("  OK access_token obtained (expires in", tokenData.expires_in, "s)");

const mcc = GOOGLE_ADS_MCC_ID.replace(/-/g, "");
console.log("\nStep 2: GAQL test against MCC", mcc);
const adsRes = await fetch(
  `https://googleads.googleapis.com/v20/customers/${mcc}/googleAds:search`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      "developer-token": GOOGLE_ADS_DEVELOPER_TOKEN,
      "login-customer-id": mcc,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: "SELECT customer.id, customer.currency_code FROM customer LIMIT 1",
    }),
  }
);
const adsData = await adsRes.json();
if (!adsRes.ok) {
  console.error("FAIL Google Ads call:", JSON.stringify(adsData, null, 2));
  process.exit(3);
}
console.log("  OK", JSON.stringify(adsData.results?.[0] ?? adsData));
console.log("\nAll green. Credentials are valid for production use.");
