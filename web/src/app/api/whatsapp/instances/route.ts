import { NextResponse } from 'next/server';
import { evoHeaders, EVOLUTION_API_URL } from '@/lib/whatsapp-sessions';

export async function GET() {
  try {
    const res = await fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
      headers: evoHeaders(),
      cache: 'no-store',
    });
    const data = await res.json();
    const list = Array.isArray(data) ? data : Object.values(data);
    return NextResponse.json(list);
  } catch (err) {
    return NextResponse.json({ error: 'Erro ao listar instâncias' }, { status: 502 });
  }
}
