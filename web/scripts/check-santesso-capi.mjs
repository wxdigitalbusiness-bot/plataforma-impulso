import { PrismaClient } from "@prisma/client";
import { createHash } from "crypto";

const db = new PrismaClient({ log: [] });

const clientes = await db.cliente.findMany({
  where: { nome: { contains: "Santesso", mode: "insensitive" } },
  select: { id: true, nome: true, evolutionInstance: true, pixelId: true, capiToken: true },
});

const c = clientes[0];
console.log(`\nCliente: ${c.nome} (id=${c.id})`);
console.log(`  evolutionInstance : ${c.evolutionInstance ?? "(vazio)"}`);
console.log(`  pixelId           : ${c.pixelId ?? "(vazio)"}`);
console.log(`  capiToken         : ${c.capiToken ? c.capiToken.slice(0, 12) + "…" : "(vazio)"}`);

// Telefone fictício hasheado (apenas para validar token/pixel)
const fakePhone = createHash("sha256").update("5511999999999").digest("hex");

const payload = {
  data: [
    {
      event_name: "Contact",
      event_time: Math.floor(Date.now() / 1000),
      action_source: "other",
      user_data: {
        ph: [fakePhone],
        client_user_agent: "Mozilla/5.0",
      },
    },
  ],
};

const url = `https://graph.facebook.com/v19.0/${c.pixelId}/events?access_token=${c.capiToken}`;

const res = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});

const json = await res.json();

if (res.ok) {
  console.log(`\n✅ Pixel ID e Token CAPI válidos!`);
  console.log(`   Eventos recebidos: ${json.events_received ?? "?"}`);
  if (json.fbtrace_id) console.log(`   fbtrace_id      : ${json.fbtrace_id}`);
} else if (json.error?.code === 190 || json.error?.message?.toLowerCase().includes("token")) {
  console.log(`\n❌ Token inválido ou expirado:`);
  console.log(`   ${json.error.message}`);
} else {
  console.log(`\n⚠ API respondeu com erro (mas o token pode estar OK):`);
  console.log(`   HTTP ${res.status} — ${json.error?.message}`);
  console.log(`   Subcode: ${json.error?.error_subcode}`);
}

await db.$disconnect();
