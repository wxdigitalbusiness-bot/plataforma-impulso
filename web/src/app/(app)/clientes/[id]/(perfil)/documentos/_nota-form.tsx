"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { criarNota, editarNota } from "./_documento-actions";

type Props = {
  clienteId: number;
  // Presente = modo edição (pré-preenche e salva em cima da nota existente).
  nota?: { id: number; nome: string; conteudo: string };
  trigger: React.ReactNode;
};

export function NotaForm({ clienteId, nota, trigger }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState(nota?.nome ?? "");
  const [conteudo, setConteudo] = useState(nota?.conteudo ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function abrir() {
    setNome(nota?.nome ?? "");
    setConteudo(nota?.conteudo ?? "");
    setErro(null);
    setOpen(true);
  }

  function salvar() {
    setErro(null);
    startTransition(async () => {
      const r = nota
        ? await editarNota(nota.id, nome, conteudo)
        : await criarNota(clienteId, nome, conteudo);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <span onClick={abrir}>{trigger}</span>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-base font-semibold text-neutral-900">
              {nota ? "Editar nota" : "Nova nota"}
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              Pra anotar dados ou informações do cliente sem precisar de um arquivo.
            </p>

            <div className="mt-4">
              <label className="mb-1 block text-xs font-medium text-neutral-700">Título</label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Acesso ao painel, dados bancários..."
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-neutral-400 focus:outline-none"
              />
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-xs font-medium text-neutral-700">Conteúdo</label>
              <textarea
                value={conteudo}
                onChange={(e) => setConteudo(e.target.value)}
                rows={6}
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-neutral-400 focus:outline-none"
              />
            </div>

            {erro && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</p>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvar}
                disabled={pending}
                className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
              >
                {pending ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
