import { readFileSync } from "fs";
import { resolve } from "path";

const envPath = resolve(process.cwd(), ".env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf-8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const [k, ...rest] = l.split("="); return [k.trim(), rest.join("=").trim().replace(/^"|"$/g, "")]; })
);

const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    client_id: env.GOOGLE_ADS_CLIENT_ID,
    client_secret: env.GOOGLE_ADS_CLIENT_SECRET,
    refresh_token: env.GOOGLE_ADS_REFRESH_TOKEN,
    grant_type: "refresh_token",
  }),
});
const { access_token } = await tokenRes.json();
console.log(`✅ Access token OK\n`);

// Testa versões de v20 a v26
for (const v of ["v20", "v21", "v22", "v23", "v24", "v25", "v26"]) {
  const res = await fetch(
    `https://googleads.googleapis.com/${v}/customers:listAccessibleCustomers`,
    {
      headers: {
        Authorization: `Bearer ${access_token}`,
        "developer-token": env.GOOGLE_ADS_DEVELOPER_TOKEN,
      },
    }
  );
  const text = await res.text();
  let msg;
  try {
    const j = JSON.parse(text);
    if (j.resourceNames) msg = `✅ OK — ${j.resourceNames.length} conta(s)`;
    else if (j.error) msg = `❌ ${j.error.status}: ${j.error.message?.slice(0, 80)}`;
    else msg = JSON.stringify(j).slice(0, 100);
  } catch {
    msg = `HTML 404`;
  }
  console.log(`  ${v}: HTTP ${res.status} → ${msg}`);
}
