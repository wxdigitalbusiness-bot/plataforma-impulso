"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { alternarMostrarResultados } from "./_resultados-actions";
import type { ResultadosFinanceiros } from "@/lib/db-insights";

type Props = {
  token: string;
  resultados: ResultadosFinanceiros;
  mostrarInicial: boolean;
  ehAgencia: boolean;
};

function fBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export function ResultadosRelatorio({ token, resultados, mostrarInicial, ehAgencia }: Props) {
  const router = useRouter();
  const [mostrar, setMostrar] = useState(mostrarInicial);
  const [pending, startTransition] = useTransition();

  // Cliente vendo o link público, sem essa seção liberada → nem renderiza
  if (!ehAgencia && !mostrar) return null;
  if (resultados.totalGeral === 0 && !ehAgencia) return null;

  function alternar() {
    const novoValor = !mostrar;
    setMostrar(novoValor);
    startTransition(async () => {
      const r = await alternarMostrarResultados(token, novoValor);
      if (!r.ok) setMostrar(!novoValor);
      router.refresh();
    });
  }

  const pctPago = resultados.totalGeral > 0
    ? Math.round((resultados.totalPago / resultados.totalGeral) * 100)
    : 0;
  const pctOrganico = resultados.totalGeral > 0 ? 100 - pctPago : 0;

  return (
    <section className="mb-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-lg">💰</span>
        <h2 className="text-sm font-semibold text-neutral-700">Resultados Financeiros</h2>
        <span className="text-[11px] text-neutral-400">Valores negociados no período</span>

        {ehAgencia && (
          <button
            onClick={alternar}
            disabled={pending}
            className={`ml-auto flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium transition-colors disabled:opacity-50 ${
              mostrar
                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
            }`}
            title="Controla se o cliente vê esta seção no link público"
          >
            <span className={`h-1.5 w-1.5 rounded-full ${mostrar ? "bg-emerald-500" : "bg-neutral-400"}`} />
            {mostrar ? "Visível pro cliente" : "Oculto pro cliente"}
          </button>
        )}
      </div>

      {resultados.totalGeral === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-200 bg-white px-4 py-6 text-center text-xs text-neutral-400">
          Nenhum valor de negociação registrado neste período ainda.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4">
            <p className="text-[10px] font-medium uppercase tracking-wide text-emerald-600">Total negociado</p>
            <p className="mt-1 text-2xl font-bold text-emerald-700">{fBRL(resultados.totalGeral)}</p>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4">
            <p className="text-[10px] font-medium uppercase tracking-wide text-blue-600">Vindo de tráfego pago</p>
            <p className="mt-1 text-2xl font-bold text-blue-700">{fBRL(resultados.totalPago)}</p>
            <p className="mt-0.5 text-[11px] text-blue-500">{pctPago}% do total</p>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-5 py-4">
            <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">Orgânico</p>
            <p className="mt-1 text-2xl font-bold text-neutral-700">{fBRL(resultados.totalOrganico)}</p>
            <p className="mt-0.5 text-[11px] text-neutral-400">{pctOrganico}% do total</p>
          </div>
        </div>
      )}
    </section>
  );
}
