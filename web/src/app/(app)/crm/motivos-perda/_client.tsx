"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adicionarMotivo, removerMotivo } from "./_actions";

type Motivo = { id: number; motivo: string };

export function MotivosClient({
  clienteId,
  motivos,
}: {
  clienteId: number;
  motivos: Motivo[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [novoMotivo, setNovoMotivo] = useState("");
  const [mostrandoForm, setMostrandoForm] = useState(false);

  function adicionar() {
    const m = novoMotivo.trim();
    if (!m) { setErro("Digite o motivo."); return; }
    setErro(null);
    startTransition(async () => {
      const r = await adicionarMotivo(clienteId, m);
      if (r.ok) {
        setNovoMotivo("");
        setMostrandoForm(false);
        router.refresh();
      } else {
        setErro(r.erro);
      }
    });
  }

  function remover(id: number, motivo: string) {
    if (!confirm(`Remover o motivo "${motivo}"?`)) return;
    setErro(null);
    startTransition(async () => {
      const r = await removerMotivo(id);
      if (r.ok) router.refresh();
      else setErro(r.erro);
    });
  }

  return (
    <div className="space-y-4">
      {erro && (
        <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{erro}</p>
      )}

      {motivos.length === 0 && !mostrandoForm ? (
        <p className="text-sm text-neutral-400">Nenhum motivo cadastrado.</p>
      ) : (
        <div className="space-y-1.5">
          {motivos.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between rounded-xl border border-neutral-100 bg-white px-4 py-2.5"
            >
              <span className="text-sm text-neutral-700">{m.motivo}</span>
              <button
                onClick={() => remover(m.id, m.motivo)}
                disabled={pending}
                className="rounded-lg px-2.5 py-1 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                Remover
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="pt-1">
        {mostrandoForm ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={novoMotivo}
              onChange={(e) => setNovoMotivo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") adicionar();
                if (e.key === "Escape") { setMostrandoForm(false); setNovoMotivo(""); }
              }}
              placeholder='Ex: "Preço fora do orçamento"'
              autoFocus
              className="flex-1 rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/10"
            />
            <button
              onClick={adicionar}
              disabled={pending || !novoMotivo.trim()}
              className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {pending ? "..." : "Adicionar"}
            </button>
            <button
              onClick={() => { setMostrandoForm(false); setNovoMotivo(""); setErro(null); }}
              className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={() => setMostrandoForm(true)}
            className="text-sm font-medium text-violet-600 hover:text-violet-700"
          >
            + Adicionar motivo
          </button>
        )}
      </div>
    </div>
  );
}
