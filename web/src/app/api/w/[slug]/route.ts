import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { slug: string };

function generateCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return "GG-" + Array.from(bytes).map((b) => chars[b % chars.length]).join("");
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { slug } = await params;
  const q = req.nextUrl.searchParams;

  const rows = await db.$queryRaw<{ wa_numero: string; mensagem: string; cliente_id: number }[]>`
    SELECT wa_numero, mensagem, cliente_id
    FROM crm_whatsapp_links
    WHERE slug = ${slug} AND ativo = true
    LIMIT 1
  `;

  if (rows.length === 0) {
    return new NextResponse("Link não encontrado.", { status: 404 });
  }

  const { wa_numero, mensagem, cliente_id } = rows[0];

  // Atribuição Google Ads: quando o snippet injeta gclid/UTMs no link, salva o clique.
  // O webhook Evolution vincula ao lead pelo mesmo client_key dentro de 30 min.
  const gclid       = q.get("gclid");
  const wbraid      = q.get("wbraid");
  const gbraid      = q.get("gbraid");
  const utmSource   = q.get("utm_source");
  const utmMedium   = q.get("utm_medium");
  const utmCampaign = q.get("utm_campaign");
  const utmContent  = q.get("utm_content");
  const utmTerm     = q.get("utm_term");

  if (gclid || wbraid || gbraid || utmSource) {
    const cliente = await db.cliente.findUnique({
      where: { id: cliente_id },
      select: { n8nClientKey: true },
    });

    if (cliente?.n8nClientKey) {
      const ip        = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "";
      const userAgent = req.headers.get("user-agent") ?? "";

      await db.$executeRaw`
        INSERT INTO google_attribution (
          code, client_key,
          gclid, wbraid, gbraid,
          utm_source, utm_medium, utm_campaign, utm_content, utm_term,
          ip, user_agent
        ) VALUES (
          ${generateCode()}, ${cliente.n8nClientKey},
          ${gclid}, ${wbraid}, ${gbraid},
          ${utmSource ?? "site"}, ${utmMedium}, ${utmCampaign}, ${utmContent}, ${utmTerm},
          ${ip}, ${userAgent}
        )
      `;
    }
  }

  const url = `https://wa.me/${wa_numero}${mensagem ? `?text=${encodeURIComponent(mensagem)}` : ""}`;
  return NextResponse.redirect(url, 302);
}
