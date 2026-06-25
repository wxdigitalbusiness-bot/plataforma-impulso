"use client";

import { useState } from "react";
import { configurarWebhookEvolution } from "./_evolution-webhook-actions";

type Props = {
  clienteId: number;
  instanceName: string;
  forwardUrl: string | null;
};

export function EvolutionWebhookConfig({ clienteId, instanceName, forwardUrl: initialForwardUrl }: Props) {
  const [loading, setLoading]     = useState(false);
  const [forwardUrl, setForwardUrl] = useState(initialForwardUrl);
  const [resultado, setResultado] = useState<{ ok: boolean; msg: string } | null>(null);

  async function handleConfigurar() {
    setLoading(true);
    setResultado(null);
    const res = await configurarWebhookEvolution(clienteId);
    if (res.ok) {
      if (res.forwardAtivo) setForwardUrl(res.urlAnterior);
      setResultado({
        ok: true,
        msg: res.urlAnterior
          ? `Webhook atualizado. A URL anterior (${res.urlAnterior}) foi salva para encaminhamento — o n8n continua recebendo.`
          : "Webhook configurado. Nenhuma URL anterior encontrada.",
      });
    } else {
      setResultado({ ok: false, msg: res.erro });
    }
    setLoading(false);
  }

  return (
    <div className="rounded-lg border border-violet-200 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-800">Webhook Evolution API</p>
          <p className="mt-0.5 text-xs text-neutral-500">
            Instância: <code className="rounded bg-neutral-100 px-1">{instanceName}</code>
          </p>
          {forwardUrl ? (
            <p className="mt-1 flex items-center gap-1 text-xs text-amber-700">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
              Encaminhando para n8n:{" "}
              <span className="truncate font-mono">{forwardUrl}</span>
            </p>
          ) : (
            <p className="mt-1 flex items-center gap-1 text-xs text-neutral-400">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-neutral-300" />
              Encaminhamento para n8n: não configurado
            </p>
          )}
        </div>
        <button
          onClick={handleConfigurar}
          disabled={loading}
          className="shrink-0 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Configurando…" : "Configurar no Evolution"}
        </button>
      </div>

      {resultado && (
        <p
          className={`rounded-lg px-3 py-2 text-xs ${
            resultado.ok
              ? "bg-green-50 text-green-800"
              : "bg-red-50 text-red-700"
          }`}
        >
          {resultado.ok ? "✓ " : "✗ "}
          {resultado.msg}
        </p>
      )}
    </div>
  );
}
