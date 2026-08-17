"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { alternarMostrarResultados, definirOrigemResultados } from "./_resultados-actions";
import type { ResultadosFinanceiros } from "@/lib/db-insights";

type OrigemFiltro = "todos" | "pago" | "organico";

type Props = {
  token: string;
  resultados: ResultadosFinanceiros;
  mostrarInicial: boolean;
  origemInicial: OrigemFiltro;
  ehAgencia: boolean;
};

function fBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

const OPCOES_ORIGEM: { valor: OrigemFiltro; label: string }[] = [
  { valor: "todos", label: "Geral + pago + orgânico" },
  { valor: "pago", label: "Só tráfego pago" },
  { valor: "organico", label: "Só orgânico" },
];

export function ResultadosRelatorio({ token, resultados, mostrarInicial, origemInicial, ehAgencia }: Props) {
  const router = useRouter();
  const [mostrar, setMostrar] = useState(mostrarInicial);
  const [origem, setOrigem] = useState<OrigemFiltro>(origemInicial);
  const [pending, startTransition] = useTransition();

  const totalExibido =
    origem === "pago" ? resultados.totalPago :
    origem === "organico" ? resultados.totalOrganico :
    resultados.totalGeral;

  // Cliente vendo o link público, sem essa seção liberada → nem renderiza
  if (!ehAgencia && !mostrar) return null;
  if (totalExibido === 0 && !ehAgencia) return null;

  function alternarVisibilidade() {
    const novoValor = !mostrar;
    setMostrar(novoValor);
    startTransition(async () => {
      const r = await alternarMostrarResultados(token, novoValor);
      if (!r.ok) setMostrar(!novoValor);
      router.refresh();
    });
  }

  function trocarOrigem(novaOrigem: OrigemFiltro) {
    const anterior = origem;
    setOrigem(novaOrigem);
    startTransition(async () => {
      const r = await definirOrigemResultados(token, novaOrigem);
      if (!r.ok) setOrigem(anterior);
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
            onClick={alternarVisibilidade}
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

      {ehAgencia && (
        <div className="mb-3 flex flex-wrap items-center gap-1 rounded-lg border border-neutral-200 bg-white p-1">
          {OPCOES_ORIGEM.map((o) => (
            <button
              key={o.valor}
              onClick={() => trocarOrigem(o.valor)}
              disabled={pending}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition disabled:opacity-50 ${
                origem === o.valor
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}

      {totalExibido === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-200 bg-white px-4 py-6 text-center text-xs text-neutral-400">
          Nenhum valor de negociação registrado neste período/filtro ainda.
        </p>
      ) : origem === "todos" ? (
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
      ) : (
        <div className={`rounded-2xl border px-5 py-4 ${
          origem === "pago" ? "border-blue-100 bg-blue-50" : "border-neutral-200 bg-neutral-50"
        }`}>
          <p className={`text-[10px] font-medium uppercase tracking-wide ${
            origem === "pago" ? "text-blue-600" : "text-neutral-500"
          }`}>
            {origem === "pago" ? "Total vindo de tráfego pago" : "Total orgânico"}
          </p>
          <p className={`mt-1 text-2xl font-bold ${
            origem === "pago" ? "text-blue-700" : "text-neutral-700"
          }`}>
            {fBRL(totalExibido)}
          </p>
        </div>
      )}
    </section>
  );
}
