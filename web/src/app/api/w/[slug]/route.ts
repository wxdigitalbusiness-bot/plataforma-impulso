import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { slug: string };

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { slug } = await params;

  const rows = await db.$queryRaw<{ wa_numero: string; mensagem: string }[]>`
    SELECT wa_numero, mensagem
    FROM crm_whatsapp_links
    WHERE slug = ${slug} AND ativo = true
    LIMIT 1
  `;

  if (rows.length === 0) {
    return new NextResponse("Link não encontrado.", { status: 404 });
  }

  const { wa_numero, mensagem } = rows[0];
  const url = `https://wa.me/${wa_numero}${mensagem ? `?text=${encodeURIComponent(mensagem)}` : ""}`;

  return NextResponse.redirect(url, 302);
}
