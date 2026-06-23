/**
 * Gera refresh_token para Google Ads API via fluxo OAuth localhost.
 * Sobe um servidor local na porta 8080 para capturar o código automaticamente.
 *
 * Pré-requisito: adicionar http://localhost:8080 nas URIs autorizadas do OAuth client
 * em console.cloud.google.com → APIs e Serviços → Credenciais
 *
 * Uso: node scripts/google-auth-refresh.mjs
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { createServer } from "http";
import { URL } from "url";

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

const CLIENT_ID     = env.GOOGLE_ADS_CLIENT_ID;
const CLIENT_SECRET = env.GOOGLE_ADS_CLIENT_SECRET;
const REDIRECT_URI  = "http://localhost:8080";
const SCOPE         = "https://www.googleapis.com/auth/adwords";

const params = new URLSearchParams({
  client_id:     CLIENT_ID,
  redirect_uri:  REDIRECT_URI,
  response_type: "code",
  scope:         SCOPE,
  access_type:   "offline",
  prompt:        "consent",
});

const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

console.log("\n── Aguardando autorização Google OAuth ─────────────────");
console.log("  Abrindo navegador… (ou copie a URL abaixo manualmente)");
console.log("\n" + authUrl + "\n");

// Tenta abrir o navegador automaticamente no Windows
import { exec } from "child_process";
exec(`start "" "${authUrl}"`);

// Sobe servidor local para capturar o callback
const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost:8080");
  const code  = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<h2>❌ Erro: ${error}</h2><p>Feche esta aba.</p>`);
    server.close();
    console.error("❌ Autorização recusada:", error);
    process.exit(1);
  }

  if (!code) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<p>Aguardando…</p>");
    return;
  }

  // Troca o code pelo refresh_token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri:  REDIRECT_URI,
      grant_type:    "authorization_code",
    }),
  });

  const data = await tokenRes.json();

  if (!data.refresh_token) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<h2>❌ Falhou</h2><pre>${JSON.stringify(data, null, 2)}</pre>`);
    server.close();
    console.error("❌ Falha ao obter refresh_token:", JSON.stringify(data));
    process.exit(1);
  }

  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(`
    <h2>✅ Autorização concluída!</h2>
    <p>Feche esta aba e veja o terminal.</p>
  `);

  server.close();

  console.log("\n✅ Refresh token obtido com sucesso!\n");
  console.log("Atualize o .env.local com a linha abaixo:\n");
  console.log(`GOOGLE_ADS_REFRESH_TOKEN=${data.refresh_token}`);
  console.log("");
});

server.listen(8080, () => {
  console.log("  Servidor local ouvindo em http://localhost:8080");
  console.log("  Aguardando callback do Google…\n");
});
