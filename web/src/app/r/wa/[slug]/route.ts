// Rota pública de redirecionamento WhatsApp com atribuição Google.
// URL de uso: /r/wa/{n8n_client_key}?gclid={gclid}&utm_campaign={...}
//
// Fluxo:
//   1. Captura gclid / wbraid / gbraid + UTMs da query string
//   2. Gera código único GG-xxxxxx e salva em google_attribution
//   3. Redireciona para wa.me/{wa_numero}?text=Olá! GG-xxxxxx
//
// O webhook da Evolution API extrai o GG-code da primeira mensagem e vincula
// o lead à entrada de atribuição — fechando o loop para o Google Ads Offline Conversions.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function generateCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return "GG-" + Array.from(bytes).map((b) => chars[b % chars.length]).join("");
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const q = req.nextUrl.searchParams;

  const cliente = await db.cliente.findFirst({
    where: { n8nClientKey: { equals: slug, mode: "insensitive" }, ativo: true },
    select: { id: true, nome: true, n8nClientKey: true, waNumero: true, waMessageTemplate: true },
  });

  if (!cliente?.waNumero) {
    return new NextResponse("Cliente não encontrado ou número WhatsApp não configurado.", {
      status: 404,
    });
  }

  const gclid      = q.get("gclid");
  const wbraid     = q.get("wbraid");
  const gbraid     = q.get("gbraid");
  const utmSource  = q.get("utm_source");
  const utmMedium  = q.get("utm_medium");
  const utmCampaign= q.get("utm_campaign");
  const utmContent = q.get("utm_content");
  const utmTerm    = q.get("utm_term");

  const code      = generateCode();
  const clientKey = cliente.n8nClientKey ?? slug;
  const ip        = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "";
  const userAgent = req.headers.get("user-agent") ?? "";

  await db.$executeRaw`
    INSERT INTO google_attribution (
      code, client_key,
      gclid, wbraid, gbraid,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      ip, user_agent
    ) VALUES (
      ${code}, ${clientKey},
      ${gclid}, ${wbraid}, ${gbraid},
      ${utmSource}, ${utmMedium}, ${utmCampaign}, ${utmContent}, ${utmTerm},
      ${ip}, ${userAgent}
    )
  `;

  const template = cliente.waMessageTemplate?.trim() || "Olá!";
  const msgText = encodeURIComponent(`${template} ${code}`);
  return NextResponse.redirect(`https://wa.me/${cliente.waNumero}?text=${msgText}`, {
    status: 302,
  });
}
