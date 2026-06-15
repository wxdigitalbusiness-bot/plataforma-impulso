import { NextRequest, NextResponse } from 'next/server';
import { createSession, evoHeaders, EVOLUTION_API_URL } from '@/lib/whatsapp-sessions';

export async function POST(req: NextRequest) {
  const { instanceName } = await req.json();
  if (!instanceName) return NextResponse.json({ error: 'instanceName obrigatório' }, { status: 400 });

  try {
    const res = await fetch(`${EVOLUTION_API_URL}/instance/connect/${encodeURIComponent(instanceName)}`, {
      headers: evoHeaders(),
      cache: 'no-store',
    });
    const data = await res.json();

    if (data.instance?.state === 'open') {
      return NextResponse.json({ error: 'Instância já está conectada.' }, { status: 400 });
    }

    // v2.3.7: campos na raiz; versões antigas: dentro de data.qrcode
    const base64 = data.base64 || data.qrcode?.base64 || null;
    const code   = data.code   || data.qrcode?.code   || null;

    if (!base64 && !code) {
      return NextResponse.json({ error: 'Evolution API não retornou QR Code.' }, { status: 400 });
    }

    const token = createSession(instanceName, { base64, code });
    const baseUrl = process.env.AUTH_URL ?? 'http://localhost:3000';
    const link = `${baseUrl}/qr/${token}`;

    return NextResponse.json({ token, link, expiresInMinutes: Number(process.env.QR_SESSION_TTL_MINUTES ?? 10) });
  } catch {
    return NextResponse.json({ error: 'Erro ao conectar instância' }, { status: 502 });
  }
}
