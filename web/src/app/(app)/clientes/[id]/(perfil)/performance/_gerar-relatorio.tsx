"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { criarRelatorioPublico } from "./_relatorio-actions";
import type { TipoRelatorio } from "@/lib/relatorios";

type Props = {
  clienteId: number;
  meses: Array<{ value: string; label: string }>;
  defaultMesAno: string;
};

export function GerarRelatorioButton({ clienteId, meses, defaultMesAno }: Props) {
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<TipoRelatorio>("semanal");
  const [mesAno, setMesAno] = useState(defaultMesAno);
  const [linkGerado, setLinkGerado] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDivElement>(null);

  // Fecha com ESC
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeAll();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function closeAll() {
    setOpen(false);
    setLinkGerado(null);
    setCopiado(false);
    setErro(null);
  }

  function gerar() {
    setErro(null);
    setLinkGerado(null);
    startTransition(async () => {
      const res = await criarRelatorioPublico({
        clienteId,
        tipo,
        mesAno: tipo === "mensal" ? mesAno : undefined,
      });
      if (!res.ok) {
        setErro(res.erro);
        return;
      }
      const url = `${window.location.origin}/r/${res.token}`;
      setLinkGerado(url);
      // Tenta copiar pra área de transferência automaticamente
      try {
        await navigator.clipboard.writeText(url);
        setCopiado(true);
      } catch {
        // Sem permissão de clipboard — usuário copia manualmente
      }
      // Abre em nova aba
      window.open(url, "_blank", "noopener,noreferrer");
    });
  }

  async function copiarManualmente() {
    if (!linkGerado) return;
    try {
      await navigator.clipboard.writeText(linkGerado);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
      >
        ↗ Gerar relatório
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeAll(); }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
          >
            <h2 className="text-base font-semibold text-neutral-900">Gerar relatório público</h2>
            <p className="mt-1 text-xs text-neutral-500">
              Escolha o período. Um link compartilhável será gerado e aberto em nova aba.
            </p>

            <fieldset className="mt-5">
              <legend className="mb-2 text-xs font-medium text-neutral-700">Período</legend>
              <div className="grid grid-cols-3 gap-2">
                {(["semanal", "quinzenal", "mensal"] as TipoRelatorio[]).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setTipo(opt)}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium capitalize transition ${
                      tipo === opt
                        ? "border-neutral-900 bg-neutral-900 text-white"
                        : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-neutral-400">
                {tipo === "semanal"   && "Últimos 7 dias (terminando ontem)."}
                {tipo === "quinzenal" && "Últimos 15 dias (terminando ontem)."}
                {tipo === "mensal"    && "Mês calendário completo (do dia 1 ao último dia do mês)."}
              </p>
            </fieldset>

            {tipo === "mensal" && (
              <div className="mt-4">
                <label className="mb-1 block text-xs font-medium text-neutral-700">Mês</label>
                <select
                  value={mesAno}
                  onChange={(e) => setMesAno(e.target.value)}
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm capitalize text-neutral-900 focus:border-neutral-400 focus:outline-none"
                >
                  {meses.map((m) => (
                    <option key={m.value} value={m.value} className="capitalize">
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {erro && (
              <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</p>
            )}

            {linkGerado && (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-xs font-medium text-emerald-800">
                  {copiado ? "✓ Link copiado e aberto em nova aba" : "Link gerado e aberto em nova aba"}
                </p>
                <div className="mt-2 flex gap-2">
                  <input
                    readOnly
                    value={linkGerado}
                    onFocus={(e) => e.currentTarget.select()}
                    className="flex-1 rounded-md border border-emerald-300 bg-white px-2 py-1 text-xs text-neutral-700"
                  />
                  <button
                    type="button"
                    onClick={copiarManualmente}
                    className="rounded-md border border-emerald-300 bg-white px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                  >
                    {copiado ? "Copiado" : "Copiar"}
                  </button>
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeAll}
                className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                {linkGerado ? "Fechar" : "Cancelar"}
              </button>
              {!linkGerado && (
                <button
                  type="button"
                  onClick={gerar}
                  disabled={pending}
                  className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
                >
                  {pending ? "Gerando..." : "Gerar link"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
