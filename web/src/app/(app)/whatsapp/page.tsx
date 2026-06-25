import { InstanceGrid, type ClienteInfo, type ClienteSemInstancia } from './_client';
import { evoHeaders, EVOLUTION_API_URL } from '@/lib/whatsapp-sessions';
import { db } from '@/lib/db';

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

async function fetchWebhookUrl(instanceName: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${EVOLUTION_API_URL}/webhook/find/${encodeURIComponent(instanceName)}`,
      { headers: evoHeaders(), cache: 'no-store' }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.url ?? data?.webhook?.url ?? null;
  } catch {
    return null;
  }
}

export default async function WhatsAppPage() {
  // Fetch tudo em paralelo
  const [evolutionInstances, clientesComInstancia, clientesSemInstancia] = await Promise.all([
    fetchInstances(),
    db.cliente.findMany({
      where:   { evolutionInstance: { not: null }, ativo: true },
      select:  { id: true, nome: true, evolutionInstance: true },
      orderBy: { nome: 'asc' },
    }),
    db.cliente.findMany({
      where:   { evolutionInstance: null, ativo: true },
      select:  { id: true, nome: true },
      orderBy: { nome: 'asc' },
    }),
  ]);

  // Mapa nome da instância → cliente
  const clienteMap = new Map<string, ClienteInfo>();
  for (const c of clientesComInstancia) {
    if (c.evolutionInstance) {
      clienteMap.set(c.evolutionInstance, {
        id:   c.id,
        nome: c.nome,
      });
    }
  }

  // Busca webhook URL de cada instância em paralelo
  const webhookUrls = await Promise.all(
    evolutionInstances.map(i => fetchWebhookUrl(i.name))
  );

  // Monta lista enriquecida
  const instances = evolutionInstances.map((inst, idx) => ({
    name:             inst.name,
    connectionStatus: inst.connectionStatus,
    webhookUrl:       webhookUrls[idx],
    cliente:          clienteMap.get(inst.name) ?? null,
  }));

  const total        = instances.length;
  const desconectadas = instances.filter(i => i.connectionStatus.toLowerCase() !== 'open').length;

  const semInstancia: ClienteSemInstancia[] = clientesSemInstancia.map(c => ({
    id:   c.id,
    nome: c.nome,
  }));

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">WhatsApp</h1>
          <p className="text-sm text-neutral-500">
            Gerencie instâncias, configure webhooks e gere links de QR Code.
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

      <InstanceGrid instances={instances} clientesSemInstancia={semInstancia} />
    </div>
  );
}
