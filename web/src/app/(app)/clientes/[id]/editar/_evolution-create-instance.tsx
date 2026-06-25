"use client";

import { useState } from "react";
import { criarInstanciaEvolution } from "./_evolution-webhook-actions";

type Props = {
  clienteId: number;
  clienteNome: string;
};

export function EvolutionCreateInstance({ clienteId, clienteNome }: Props) {
  const [instanceName, setInstanceName] = useState(clienteNome);
  const [n8nUrl, setN8nUrl]             = useState("");
  const [loading, setLoading]           = useState(false);
  const [erro, setErro]                 = useState<string | null>(null);
  const [qrLink, setQrLink]             = useState<string | null>(null);
  const [qrLoading, setQrLoading]       = useState(false);
  const [criado, setCriado]             = useState(false);

  async function handleCriar() {
    setLoading(true);
    setErro(null);
    const res = await criarInstanciaEvolution(clienteId, instanceName, n8nUrl || null);
    setLoading(false);
    if (res.ok) {
      setCriado(true);
    } else {
      setErro(res.erro);
    }
  }

  async function handleGerarQr() {
    setQrLoading(true);
    setQrLink(null);
    try {
      const res = await fetch("/api/whatsapp/qr/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceName }),
      });
      const data = await res.json();
      if (data.link) {
        setQrLink(data.link);
      } else {
        setErro(data.error ?? "Erro ao gerar QR Code.");
      }
    } catch {
      setErro("Erro ao gerar QR Code.");
    }
    setQrLoading(false);
  }

  if (criado) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green-500 text-white text-sm font-bold">✓</span>
          <div>
            <p className="text-sm font-semibold text-green-800">Instância criada no Evolution!</p>
            <p className="text-xs text-green-700">
              <code className="font-mono">{instanceName}</code> — webhook configurado para a plataforma
              {n8nUrl && " (encaminhand para n8n)"}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-green-200 bg-white p-4 space-y-2">
          <p className="text-xs font-medium text-neutral-700">
            Agora conecte o WhatsApp escaneando o QR Code:
          </p>
          {qrLink ? (
            <div className="space-y-2">
              <p className="text-xs text-neutral-500">Link gerado (válido por 10 min):</p>
              <a
                href={qrLink}
                target="_blank"
                rel="noopener noreferrer"
                className="block truncate rounded-lg bg-violet-50 px-3 py-2 text-xs font-mono text-violet-700 hover:bg-violet-100"
              >
                {qrLink}
              </a>
              <button
                onClick={() => navigator.clipboard.writeText(qrLink)}
                className="text-xs text-violet-600 hover:underline"
              >
                Copiar link
              </button>
            </div>
          ) : (
            <button
              onClick={handleGerarQr}
              disabled={qrLoading}
              className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {qrLoading ? "Gerando…" : "Gerar link QR Code"}
            </button>
          )}
        </div>

        {erro && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">✗ {erro}</p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-5 space-y-4">
      <div>
        <p className="text-sm font-semibold text-violet-900">Criar instância no Evolution API</p>
        <p className="mt-0.5 text-xs text-neutral-500">
          Cria a instância, configura o webhook para a plataforma e já deixa pronto para conectar o WhatsApp.
        </p>
      </div>

      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-neutral-700">
            Nome da instância <span className="text-red-500">*</span>
          </span>
          <input
            value={instanceName}
            onChange={(e) => setInstanceName(e.target.value)}
            placeholder="Ex.: Sarah Carmo - Multimarcas"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10"
          />
          <p className="mt-1 text-xs text-neutral-400">
            Este nome será o identificador da instância no Evolution API.
          </p>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-neutral-700">
            URL webhook n8n existente{" "}
            <span className="font-normal text-neutral-400">(opcional — para clientes com fluxo n8n ativo)</span>
          </span>
          <input
            value={n8nUrl}
            onChange={(e) => setN8nUrl(e.target.value)}
            placeholder="https://impulso-n8n.drx3h6.easypanel.host/webhook/…"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm font-mono outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10"
          />
          <p className="mt-1 text-xs text-neutral-400">
            Se preenchido, as mensagens serão encaminhadas para este URL após serem processadas pela plataforma —
            mantendo os fluxos do n8n funcionando durante a migração.
          </p>
        </label>
      </div>

      {erro && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">✗ {erro}</p>
      )}

      <button
        onClick={handleCriar}
        disabled={loading || !instanceName.trim()}
        className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
      >
        {loading ? "Criando instância…" : "Criar instância no Evolution"}
      </button>
    </div>
  );
}
