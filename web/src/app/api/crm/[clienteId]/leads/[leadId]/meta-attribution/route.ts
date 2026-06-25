import { NextRequest, NextResponse } from "next/server";

type Params = { clienteId: string; leadId: string };

export type MetaAdInfo = {
  adId: string;
  adNome: string | null;
  adSetId: string | null;
  adSetNome: string | null;
  campanhaId: string | null;
  campanhaNome: string | null;
};

const GRAPH_VERSION = "v21.0";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  await params; // clienteId/leadId não precisamos validar — o ad_id vem da query

  const adId = req.nextUrl.searchParams.get("adId");
  if (!adId) return NextResponse.json({ error: "adId obrigatório" }, { status: 400 });

  const token = process.env.META_ACCESS_TOKEN;
  if (!token) return NextResponse.json({ error: "META_ACCESS_TOKEN não configurado" }, { status: 500 });

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${adId}?fields=name,adset%7Bid%2Cname%7D,campaign%7Bid%2Cname%7D&access_token=${token}`;

  const res = await fetch(url, { next: { revalidate: 3600 } }); // cache 1h — nome do anúncio não muda com frequência
  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: `Erro Meta API: ${err}` }, { status: res.status });
  }

  const data = await res.json() as {
    id: string;
    name?: string;
    adset?: { id: string; name: string };
    campaign?: { id: string; name: string };
    error?: { message: string };
  };

  if (data.error) {
    return NextResponse.json({ error: data.error.message }, { status: 400 });
  }

  const result: MetaAdInfo = {
    adId: data.id,
    adNome: data.name ?? null,
    adSetId: data.adset?.id ?? null,
    adSetNome: data.adset?.name ?? null,
    campanhaId: data.campaign?.id ?? null,
    campanhaNome: data.campaign?.name ?? null,
  };

  return NextResponse.json(result);
}
