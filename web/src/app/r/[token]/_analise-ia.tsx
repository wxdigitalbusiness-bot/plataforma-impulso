"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { gerarAnaliseIA, salvarAnaliseIA } from "./_analise-actions";

type Props = {
  token: string;
  analiseInicial: string | null;
  ehAgencia: boolean;
};

export function AnaliseIA({ token, analiseInicial, ehAgencia }: Props) {
  const router = useRouter();
  const [texto, setTexto] = useState(analiseInicial ?? "");
  const [salvo, setSalvo] = useState(analiseInicial ?? "");
  const [editando, setEditando] = useState(false);
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function gerar() {
    setErro(null);
    startTransition(async () => {
      const r = await gerarAnaliseIA(token);
      if (r.ok) {
        setTexto(r.texto);
        setSalvo(r.texto);
        router.refresh();
      } else {
        setErro(r.erro);
      }
    });
  }

  function salvar() {
    setErro(null);
    startTransition(async () => {
      const r = await salvarAnaliseIA(token, texto);
      if (r.ok) {
        setSalvo(texto);
        setEditando(false);
        router.refresh();
      } else {
        setErro(r.erro);
      }
    });
  }

  function cancelar() {
    setTexto(salvo);
    setEditando(false);
    setErro(null);
  }

  // Cliente vendo o link público sem análise gerada ainda → seção nem aparece
  if (!ehAgencia && !salvo) return null;

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-lg">🤖</span>
        <h2 className="text-sm font-semibold text-neutral-700">Análise</h2>
        {ehAgencia && (
          <span className="text-[11px] text-neutral-400">gerada por IA — revise antes de compartilhar</span>
        )}
      </div>

      {!salvo && ehAgencia && (
        <button
          onClick={gerar}
          disabled={pending}
          className="w-full rounded-xl border border-dashed border-neutral-300 px-4 py-3 text-left text-sm text-neutral-500 transition-colors hover:border-neutral-400 hover:bg-neutral-50 disabled:opacity-50"
        >
          {pending ? "Gerando análise..." : "+ Gerar análise com IA"}
        </button>
      )}

      {salvo && !editando && (
        <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-white p-5">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">{salvo}</p>
          {ehAgencia && (
            <div className="mt-3 flex gap-3 border-t border-violet-100 pt-3">
              <button
                onClick={() => setEditando(true)}
                className="text-xs font-medium text-violet-600 hover:text-violet-700"
              >
                Editar
              </button>
              <button
                onClick={gerar}
                disabled={pending}
                className="text-xs font-medium text-neutral-400 hover:text-neutral-600 disabled:opacity-50"
              >
                {pending ? "Gerando..." : "Gerar de novo"}
              </button>
            </div>
          )}
        </div>
      )}

      {editando && (
        <div className="rounded-2xl border border-violet-200 bg-white p-4">
          <textarea
            autoFocus
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={8}
            className="w-full resize-y rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-700 outline-none focus:border-violet-400"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              onClick={cancelar}
              className="rounded-lg px-3 py-1.5 text-xs text-neutral-500 hover:bg-neutral-100"
            >
              Cancelar
            </button>
            <button
              onClick={salvar}
              disabled={pending || !texto.trim()}
              className="rounded-lg bg-violet-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {pending ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      )}

      {erro && <p className="mt-2 text-xs text-red-600">{erro}</p>}
    </section>
  );
}
