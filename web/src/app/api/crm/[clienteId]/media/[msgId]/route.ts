// Proxy para mídia de áudio do WhatsApp.
// A URL salva em crm_mensagens para áudio é criptografada (.enc).
// Este endpoint chama a Evolution API para descriptografar e retorna o áudio ao browser.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { EVOLUTION_API_URL, evoHeaders } from "@/lib/whatsapp-sessions";

type Params = { clienteId: string; msgId: string };

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { clienteId, msgId } = await params;
  const id = parseInt(clienteId, 10);
  if (isNaN(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const cliente = await db.cliente.findUnique({
    where: { id },
    select: { n8nClientKey: true, evolutionInstance: true },
  });

  if (!cliente?.n8nClientKey || !cliente.evolutionInstance) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }

  type MsgRow = { evolution_msg_id: string | null; lead_id: string; de: string };
  const rows = await db.$queryRaw<MsgRow[]>`
    SELECT evolution_msg_id, lead_id, de
    FROM crm_mensagens
    WHERE id = ${BigInt(msgId)}
      AND client_key = ${cliente.n8nClientKey}
  `;

  const msg = rows[0];
  if (!msg?.evolution_msg_id) {
    return NextResponse.json({ error: "Mensagem não encontrada" }, { status: 404 });
  }

  const fromMe = msg.de === "atendente";
  const remoteJid = `${msg.lead_id}@s.whatsapp.net`;

  const evoRes = await fetch(
    `${EVOLUTION_API_URL}/chat/getBase64FromMediaMessage/${encodeURIComponent(cliente.evolutionInstance)}`,
    {
      method: "POST",
      headers: { ...evoHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          key: { id: msg.evolution_msg_id, fromMe, remoteJid },
        },
        convertToMp4: false,
      }),
    }
  );

  if (!evoRes.ok) {
    return NextResponse.json({ error: "Falha ao buscar mídia na Evolution" }, { status: 502 });
  }

  const data = await evoRes.json() as { base64?: string; mimetype?: string };

  if (!data.base64) {
    return NextResponse.json({ error: "Mídia não disponível" }, { status: 404 });
  }

  const buffer = Buffer.from(data.base64, "base64");
  const mimetype = data.mimetype ?? "audio/ogg";

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": mimetype,
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
