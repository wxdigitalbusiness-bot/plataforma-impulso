import { InstanceGrid } from './_client';
import { evoHeaders, EVOLUTION_API_URL } from '@/lib/whatsapp-sessions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function fetchInstances() {
  try {
    const res = await fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
      headers: evoHeaders(),
      cache: 'no-store',
    });
    const data = await res.json();
    const list = Array.isArray(data) ? data : Object.values(data);
    return list as Array<{ name: string; connectionStatus: string }>;
  } catch {
    return [];
  }
}

export default async function WhatsAppPage() {
  const instances = await fetchInstances();
  const total        = instances.length;
  const desconectadas = instances.filter(i => i.connectionStatus.toLowerCase() !== 'open').length;

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">WhatsApp</h1>
          <p className="text-sm text-neutral-500">
            Gerencie as instâncias da Evolution API. Gere links de QR Code para clientes reconectarem.
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm text-neutral-500">
          <span>{total} instância{total !== 1 ? 's' : ''}</span>
          {desconectadas > 0 && (
            <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
              {desconectadas} desconectada{desconectadas !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </header>

      <InstanceGrid instances={instances} />
    </div>
  );
}
