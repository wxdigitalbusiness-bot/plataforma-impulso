import { NextRequest, NextResponse } from 'next/server';
import { getSession, evoHeaders, EVOLUTION_API_URL } from '@/lib/whatsapp-sessions';

type Params = { params: Promise<{ token: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params;
  const session = getSession(token);

  if (!session) {
    return NextResponse.json({ error: 'Sessão não encontrada ou expirada.' }, { status: 404 });
  }

  try {
    const res = await fetch(
      `${EVOLUTION_API_URL}/instance/connect/${encodeURIComponent(session.instanceName)}`,
      { headers: evoHeaders(), cache: 'no-store' }
    );
    const data = await res.json();

    if (data.instance?.state === 'open') {
      session.status = 'connected';
      return NextResponse.json({ status: 'connected', instanceName: session.instanceName });
    }

    const base64 = data.base64 || data.qrcode?.base64 || session.lastQr.base64;
    const code   = data.code   || data.qrcode?.code   || session.lastQr.code;
    session.lastQr = { base64, code };

    return NextResponse.json({
      status: 'pending',
      instanceName: session.instanceName,
      qr: { base64, code },
      expiresAt: session.expiresAt,
    });
  } catch {
    return NextResponse.json({
      status: 'pending',
      instanceName: session.instanceName,
      qr: session.lastQr,
      expiresAt: session.expiresAt,
    });
  }
}
