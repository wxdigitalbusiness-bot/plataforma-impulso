"use client";

import { useEffect, useRef, useState } from "react";

type Motivo = { id: string; label: string; padrao: boolean };

type Props = {
  clienteId: number;
  onConfirm: (motivo: string) => void;
  onCancel: () => void;
};

export function MotivoPerdaModal({ clienteId, onConfirm, onCancel }: Props) {
  const [motivos, setMotivos]       = useState<Motivo[]>([]);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [novoMotivo, setNovoMotivo]  = useState("");
  const [adicionando, setAdicionando] = useState(false);
  const [salvando, setSalvando]      = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/crm/${clienteId}/motivos-perda`)
      .then((r) => r.json())
      .then((d: { motivos: Motivo[] }) => setMotivos(d.motivos))
      .catch(() => {/* ignora */});
  }, [clienteId]);

  useEffect(() => {
    if (adicionando) inputRef.current?.focus();
  }, [adicionando]);

  async function salvarNovoMotivo() {
    const label = novoMotivo.trim();
    if (!label) return;
    setSalvando(true);
    try {
      const res = await fetch(`/api/crm/${clienteId}/motivos-perda`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      if (!res.ok) return;
      const { motivo } = await res.json() as { motivo: Motivo };
      setMotivos((prev) => [...prev, motivo]);
      setSelecionado(motivo.label);
      setNovoMotivo("");
      setAdicionando(false);
    } finally { setSalvando(false); }
  }

  function handleConfirm() {
    if (!selecionado) return;
    onConfirm(selecionado);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-neutral-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
          <div>
            <p className="font-semibold text-neutral-900">Motivo da perda</p>
            <p className="text-xs text-neutral-500">Selecione o motivo pelo qual este lead foi perdido</p>
          </div>
          <button
            onClick={onCancel}
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Lista de motivos */}
        <div className="max-h-60 overflow-y-auto px-2 py-2">
          {motivos.length === 0 ? (
            <p className="py-4 text-center text-xs text-neutral-400">Carregando...</p>
          ) : (
            motivos.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelecionado(m.label)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                  selecionado === m.label
                    ? "bg-red-50 text-red-700"
                    : "text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                  selecionado === m.label
                    ? "border-red-500 bg-red-500"
                    : "border-neutral-300"
                }`}>
                  {selecionado === m.label && (
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  )}
                </span>
                <span>{m.label}</span>
                {!m.padrao && (
                  <span className="ml-auto text-[10px] text-neutral-400">personalizado</span>
                )}
              </button>
            ))
          )}
        </div>

        {/* Adicionar novo motivo */}
        <div className="border-t border-neutral-100 px-4 py-3">
          {adicionando ? (
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={novoMotivo}
                onChange={(e) => setNovoMotivo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") salvarNovoMotivo();
                  if (e.key === "Escape") { setAdicionando(false); setNovoMotivo(""); }
                }}
                placeholder="Descreva o motivo..."
                className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-800 outline-none focus:border-neutral-400 placeholder:text-neutral-400"
              />
              <button
                onClick={salvarNovoMotivo}
                disabled={!novoMotivo.trim() || salvando}
                className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-40"
              >
                {salvando ? "..." : "Salvar"}
              </button>
              <button
                onClick={() => { setAdicionando(false); setNovoMotivo(""); }}
                className="rounded-lg border border-neutral-200 px-3 py-2 text-xs text-neutral-500 hover:bg-neutral-50"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAdicionando(true)}
              className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-800"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Adicionar novo motivo
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-neutral-100 px-4 py-3">
          <button
            onClick={onCancel}
            className="rounded-xl border border-neutral-200 px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selecionado}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40"
          >
            Confirmar perda
          </button>
        </div>
      </div>
    </div>
  );
}
