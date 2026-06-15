'use client';

import { useState } from 'react';

type Instance = {
  name: string;
  connectionStatus: 'open' | 'close' | 'connecting' | string;
};

function statusInfo(status: string) {
  const s = status.toLowerCase();
  if (s === 'open')       return { label: 'Conectado',    dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' };
  if (s === 'close')      return { label: 'Desconectado', dot: 'bg-red-500 animate-pulse', text: 'text-red-700', bg: 'bg-red-50' };
  if (s === 'connecting') return { label: 'Conectando…',  dot: 'bg-amber-500 animate-pulse', text: 'text-amber-700', bg: 'bg-amber-50' };
  return                         { label: status,          dot: 'bg-neutral-400', text: 'text-neutral-600', bg: 'bg-neutral-100' };
}

function InstanceCard({ instance }: { instance: Instance }) {
  const [loading, setLoading] = useState(false);
  const [link, setLink]       = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [copied, setCopied]   = useState(false);

  const info = statusInfo(instance.connectionStatus);
  const isDisconnected = instance.connectionStatus.toLowerCase() !== 'open';

  async function generateQr() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/whatsapp/qr/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceName: instance.name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro ao gerar QR');
      setLink(data.link);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function shareWhatsApp() {
    if (!link) return;
    const msg = encodeURIComponent(
      `Olá! Para reconectar o WhatsApp, acesse este link e escaneie o QR Code com seu celular:\n\n${link}\n\n⏳ O link expira em 10 minutos.`
    );
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <div className="mb-3 flex items-start justify-between gap-2">
        <p className="truncate font-medium text-neutral-900" title={instance.name}>
          {instance.name}
        </p>
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${info.bg} ${info.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${info.dot}`} />
          {info.label}
        </span>
      </div>

      {!link ? (
        <>
          <button
            onClick={generateQr}
            disabled={!isDisconnected || loading}
            className="w-full rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400"
          >
            {loading ? 'Gerando…' : isDisconnected ? 'Gerar link QR' : '✓ Já conectado'}
          </button>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </>
      ) : (
        <div className="space-y-2">
          <p className="break-all rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-600 border border-neutral-200">
            {link}
          </p>
          <div className="flex gap-2">
            <button
              onClick={copyLink}
              className="flex-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
            >
              {copied ? '✓ Copiado!' : 'Copiar link'}
            </button>
            <button
              onClick={shareWhatsApp}
              className="flex-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
            >
              Enviar via WA
            </button>
          </div>
          <button
            onClick={() => { setLink(null); setError(null); }}
            className="w-full text-center text-xs text-neutral-400 hover:text-neutral-600"
          >
            ↻ Gerar novo link
          </button>
          <p className="text-center text-[10px] text-neutral-400">Link expira em 10 minutos</p>
        </div>
      )}
    </div>
  );
}

export function InstanceGrid({ instances }: { instances: Instance[] }) {
  const desconectadas = instances.filter(i => i.connectionStatus.toLowerCase() !== 'open');
  const conectadas    = instances.filter(i => i.connectionStatus.toLowerCase() === 'open');

  return (
    <div className="space-y-6">
      {desconectadas.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-neutral-700">
            Precisam de atenção
            <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              {desconectadas.length}
            </span>
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {desconectadas.map(i => <InstanceCard key={i.name} instance={i} />)}
          </div>
        </section>
      )}
      {conectadas.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-neutral-700">Conectadas</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {conectadas.map(i => <InstanceCard key={i.name} instance={i} />)}
          </div>
        </section>
      )}
      {instances.length === 0 && (
        <p className="py-12 text-center text-sm text-neutral-400">Nenhuma instância encontrada.</p>
      )}
    </div>
  );
}
