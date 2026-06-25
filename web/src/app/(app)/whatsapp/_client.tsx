'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { configurarWebhookInstancia, criarNovaInstancia } from './_actions';

export type ClienteInfo = {
  id: number;
  nome: string;
};

export type ClienteSemInstancia = {
  id: number;
  nome: string;
};

type Instance = {
  name: string;
  connectionStatus: string;
  webhookUrl: string | null;
  cliente: ClienteInfo | null;
};

// ── Helpers ────────────────────────────────────────────────────────────────

function statusInfo(status: string) {
  const s = status.toLowerCase();
  if (s === 'open')       return { label: 'Conectado',    dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' };
  if (s === 'close')      return { label: 'Desconectado', dot: 'bg-red-500 animate-pulse', text: 'text-red-700', bg: 'bg-red-50' };
  if (s === 'connecting') return { label: 'Conectando…',  dot: 'bg-amber-500 animate-pulse', text: 'text-amber-700', bg: 'bg-amber-50' };
  return                         { label: status,          dot: 'bg-neutral-400', text: 'text-neutral-600', bg: 'bg-neutral-100' };
}

function isPlatformUrl(url: string | null) {
  return !!url?.includes('/api/webhooks/evolution');
}

function urlShort(url: string | null) {
  if (!url) return null;
  try { return new URL(url).hostname; } catch { return url.slice(0, 40); }
}

// ── Card de instância ──────────────────────────────────────────────────────

function InstanceCard({ instance }: { instance: Instance }) {
  const router = useRouter();

  const [qrLoading, setQrLoading] = useState(false);
  const [qrLink, setQrLink]       = useState<string | null>(null);
  const [qrError, setQrError]     = useState<string | null>(null);
  const [qrCopied, setQrCopied]   = useState(false);

  const [whConfig, setWhConfig]   = useState(false);
  const [whLoading, setWhLoading] = useState(false);
  const [whResult, setWhResult]   = useState<{ ok: boolean; msg: string } | null>(null);

  const info           = statusInfo(instance.connectionStatus);
  const isDisconnected = instance.connectionStatus.toLowerCase() !== 'open';
  const onPlataforma   = isPlatformUrl(instance.webhookUrl);

  // ── QR Code ──────────────────────────────────────────────────────────────

  async function generateQr() {
    setQrLoading(true); setQrError(null);
    try {
      const res  = await fetch('/api/whatsapp/qr/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceName: instance.name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro ao gerar QR');
      setQrLink(data.link);
    } catch (e) {
      setQrError(e instanceof Error ? e.message : 'Erro desconhecido');
    } finally { setQrLoading(false); }
  }

  async function copyQr() {
    if (!qrLink) return;
    await navigator.clipboard.writeText(qrLink);
    setQrCopied(true); setTimeout(() => setQrCopied(false), 2000);
  }

  // ── Webhook ───────────────────────────────────────────────────────────────

  async function handleConfigurarWebhook() {
    setWhLoading(true); setWhResult(null);
    const res = await configurarWebhookInstancia(instance.name, instance.cliente?.id ?? null);
    setWhLoading(false);
    if (res.ok) {
      setWhResult({ ok: true, msg: 'Webhook configurado para a plataforma.' });
      setWhConfig(false);
      router.refresh();
    } else {
      setWhResult({ ok: false, msg: res.erro });
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 space-y-4">
      {/* Cabeçalho: nome + status */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-neutral-900" title={instance.name}>
            {instance.name}
          </p>
          {instance.cliente ? (
            <p className="mt-0.5 text-xs text-neutral-400">
              Cliente: <span className="font-medium text-neutral-600">{instance.cliente.nome}</span>
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-neutral-400 italic">Sem cliente vinculado</p>
          )}
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${info.bg} ${info.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${info.dot}`} />
          {info.label}
        </span>
      </div>

      {/* Status do webhook */}
      <div className="rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs">
            <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${onPlataforma ? 'bg-violet-500' : 'bg-amber-400'}`} />
            {onPlataforma ? (
              <span className="text-violet-700 font-medium">Webhook → Plataforma</span>
            ) : (
              <span className="text-amber-700 font-medium">
                Webhook → {urlShort(instance.webhookUrl) ?? 'não configurado'}
              </span>
            )}
          </div>
          {!onPlataforma && (
            <button
              onClick={() => { setWhConfig(!whConfig); setWhResult(null); }}
              className="shrink-0 text-xs text-violet-600 hover:underline"
            >
              {whConfig ? 'Cancelar' : 'Configurar'}
            </button>
          )}
        </div>

        {whConfig && (
          <div className="pt-1 border-t border-neutral-200">
            <button
              onClick={handleConfigurarWebhook}
              disabled={whLoading}
              className="w-full rounded-md bg-violet-600 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {whLoading ? 'Configurando…' : 'Apontar webhook → plataforma'}
            </button>
          </div>
        )}

        {whResult && (
          <p className={`text-xs rounded-md px-2 py-1.5 ${whResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {whResult.ok ? '✓ ' : '✗ '}{whResult.msg}
          </p>
        )}
      </div>

      {/* QR Code */}
      {!qrLink ? (
        <>
          <button
            onClick={generateQr}
            disabled={!isDisconnected || qrLoading}
            className="w-full rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400"
          >
            {qrLoading ? 'Gerando…' : isDisconnected ? 'Gerar link QR' : '✓ Já conectado'}
          </button>
          {qrError && <p className="text-xs text-red-600">{qrError}</p>}
        </>
      ) : (
        <div className="space-y-2">
          <p className="break-all rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-600 border border-neutral-200">{qrLink}</p>
          <div className="flex gap-2">
            <button onClick={copyQr} className="flex-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50">
              {qrCopied ? '✓ Copiado!' : 'Copiar link'}
            </button>
            <button
              onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Acesse este link para reconectar o WhatsApp:\n\n${qrLink}\n\n⏳ Expira em 10 minutos.`)}`, '_blank')}
              className="flex-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
            >
              Enviar via WA
            </button>
          </div>
          <button onClick={() => { setQrLink(null); setQrError(null); }} className="w-full text-center text-xs text-neutral-400 hover:text-neutral-600">
            ↻ Gerar novo link
          </button>
          <p className="text-center text-[10px] text-neutral-400">Link expira em 10 minutos</p>
        </div>
      )}
    </div>
  );
}

// ── Painel Nova Instância ──────────────────────────────────────────────────

function NovaInstanciaPanel({
  clientesSemInstancia,
  onClose,
}: {
  clientesSemInstancia: ClienteSemInstancia[];
  onClose: () => void;
}) {
  const router = useRouter();

  const [nome, setNome]           = useState('');
  const [clienteId, setClienteId] = useState<number | null>(null);
  const [loading, setLoading]     = useState(false);
  const [erro, setErro]           = useState<string | null>(null);
  const [criado, setCriado]       = useState(false);
  const [qrLink, setQrLink]       = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  async function handleCriar() {
    setLoading(true); setErro(null);
    const res = await criarNovaInstancia(nome, clienteId);
    setLoading(false);
    if (res.ok) { setCriado(true); router.refresh(); }
    else { setErro(res.erro); }
  }

  async function handleQr() {
    setQrLoading(true);
    try {
      const res  = await fetch('/api/whatsapp/qr/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceName: nome }),
      });
      const data = await res.json();
      if (data.link) setQrLink(data.link);
      else setErro(data.error ?? 'Erro ao gerar QR.');
    } catch { setErro('Erro ao gerar QR.'); }
    setQrLoading(false);
  }

  if (criado) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-green-800">
            ✓ Instância <code className="font-mono">{nome}</code> criada!
          </p>
          <button onClick={onClose} className="text-xs text-green-600 hover:underline">Fechar</button>
        </div>
        {qrLink ? (
          <div className="space-y-2">
            <p className="text-xs text-neutral-500">Link QR (válido por 10 min):</p>
            <p className="break-all rounded-lg bg-white border border-green-200 px-3 py-2 text-xs font-mono text-violet-700">{qrLink}</p>
            <button onClick={() => navigator.clipboard.writeText(qrLink)} className="text-xs text-violet-600 hover:underline">
              Copiar link
            </button>
          </div>
        ) : (
          <button
            onClick={handleQr}
            disabled={qrLoading}
            className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {qrLoading ? 'Gerando…' : 'Gerar link QR Code'}
          </button>
        )}
        {erro && <p className="text-xs text-red-600">{erro}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-violet-900">Nova instância Evolution API</p>
        <button onClick={onClose} className="text-xs text-neutral-400 hover:text-neutral-600">✕ Cancelar</button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-neutral-700">Nome da instância *</span>
          <input
            value={nome}
            onChange={e => setNome(e.target.value)}
            placeholder="Ex.: Sarah Carmo - Multimarcas"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-violet-500"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-neutral-700">Vincular ao cliente</span>
          <select
            value={clienteId ?? ''}
            onChange={e => setClienteId(e.target.value ? Number(e.target.value) : null)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-violet-500"
          >
            <option value="">— sem vínculo —</option>
            {clientesSemInstancia.map(c => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </label>
      </div>

      {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">✗ {erro}</p>}

      <button
        onClick={handleCriar}
        disabled={loading || !nome.trim()}
        className="rounded-lg bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
      >
        {loading ? 'Criando…' : 'Criar instância'}
      </button>
    </div>
  );
}

// ── Grid principal ─────────────────────────────────────────────────────────

export function InstanceGrid({
  instances,
  clientesSemInstancia,
}: {
  instances: Instance[];
  clientesSemInstancia: ClienteSemInstancia[];
}) {
  const [showNova, setShowNova] = useState(false);

  const desconectadas = instances.filter(i => i.connectionStatus.toLowerCase() !== 'open');
  const conectadas    = instances.filter(i => i.connectionStatus.toLowerCase() === 'open');

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={() => setShowNova(!showNova)}
          className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition-colors"
        >
          <span className="text-base leading-none">+</span>
          Nova instância
        </button>
      </div>

      {showNova && (
        <NovaInstanciaPanel
          clientesSemInstancia={clientesSemInstancia}
          onClose={() => setShowNova(false)}
        />
      )}

      {instances.length === 0 && (
        <p className="py-12 text-center text-sm text-neutral-400">Nenhuma instância encontrada.</p>
      )}

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
    </div>
  );
}
