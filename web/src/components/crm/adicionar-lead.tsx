"use client";

import { useState, useTransition } from "react";

type Props = {
  clienteId: number;
  onCriado: () => void;
};

export function AdicionarLead({ clienteId, onCriado }: Props) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [observacao, setObservacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function abrir() {
    setNome(""); setWhatsapp(""); setObservacao("");
    setErro(null); setAviso(null);
    setOpen(true);
  }

  function salvar() {
    setErro(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/crm/${clienteId}/leads`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nome, whatsapp, observacao }),
        });
        const data = await res.json();
        if (!res.ok) {
          setErro(data.error ?? "Erro ao criar o lead.");
          return;
        }
        onCriado();
        if (!data.isNew) {
          setAviso("Já existia um lead com esse WhatsApp — os dados dele foram atualizados.");
          return;
        }
        setOpen(false);
      } catch {
        setErro("Erro ao criar o lead. Tente de novo.");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="flex shrink-0 items-center gap-1 rounded-lg bg-neutral-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-neutral-800"
      >
        + Adicionar lead
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-base font-semibold text-neutral-900">Adicionar lead manualmente</h2>
            <p className="mt-1 text-xs text-neutral-500">
              Pra contatos que vieram por outro canal (telefone, presencial, indicação) e não pelo WhatsApp.
            </p>

            <div className="mt-4">
              <label className="mb-1 block text-xs font-medium text-neutral-700">Nome</label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-neutral-400 focus:outline-none"
              />
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-xs font-medium text-neutral-700">WhatsApp</label>
              <input
                type="text"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="Ex.: (63) 98438-6017"
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-neutral-400 focus:outline-none"
              />
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-xs font-medium text-neutral-700">Origem / observação (opcional)</label>
              <textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                rows={3}
                placeholder="Ex.: Indicação da Maria, ligou no telefone fixo..."
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-neutral-400 focus:outline-none"
              />
            </div>

            {erro && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</p>
            )}
            {aviso && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">{aviso}</p>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                {aviso ? "Fechar" : "Cancelar"}
              </button>
              {!aviso && (
                <button
                  type="button"
                  onClick={salvar}
                  disabled={pending}
                  className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
                >
                  {pending ? "Salvando..." : "Adicionar"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
