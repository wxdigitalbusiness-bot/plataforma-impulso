"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { criarFatura } from "./_fatura-actions";

export function NovaFatura({ clienteId }: { clienteId: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [vencimento, setVencimento] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function closeAll() {
    setOpen(false);
    setDescricao("");
    setValor("");
    setVencimento("");
    setErro(null);
  }

  function salvar() {
    setErro(null);
    startTransition(async () => {
      const r = await criarFatura({
        clienteId,
        descricao,
        valor: Number(valor.replace(",", ".")),
        vencimento,
      });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      closeAll();
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
      >
        + Nova fatura
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeAll(); }}
        >
          <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-base font-semibold text-neutral-900">Nova fatura</h2>

            <label className="mt-4 block">
              <span className="mb-1 block text-xs font-medium text-neutral-700">Descrição</span>
              <input
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex.: Mensalidade agosto/2026"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
              />
            </label>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-neutral-700">Valor (R$)</span>
                <input
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  inputMode="decimal"
                  placeholder="1500,00"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-neutral-700">Vencimento</span>
                <input
                  type="date"
                  value={vencimento}
                  onChange={(e) => setVencimento(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
                />
              </label>
            </div>

            {erro && (
              <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</p>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeAll}
                className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvar}
                disabled={pending || !descricao.trim() || !valor || !vencimento}
                className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
              >
                {pending ? "Salvando..." : "Criar fatura"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
