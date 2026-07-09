"use client";

import type { GoogleLeadAtribuicao } from "@/lib/db-insights";

type Props = {
  dados: GoogleLeadAtribuicao[];
  totalGeral: number;
};

export function GoogleLeadsAtribuicao({ dados, totalGeral }: Props) {
  // Agrupa por campanha
  const campMap = new Map<string, { nome: string; leads: number; porFase: Array<{ fase: string; qtd: number }> }>();
  for (const d of dados) {
    const entry = campMap.get(d.campanhaId) ?? { nome: d.campanhaNome, leads: 0, porFase: [] };
    entry.leads += d.leads;
    const f = entry.porFase.find((x) => x.fase === d.fase);
    if (f) f.qtd += d.leads; else entry.porFase.push({ fase: d.fase, qtd: d.leads });
    campMap.set(d.campanhaId, entry);
  }
  const campanhas = [...campMap.entries()]
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.leads - a.leads);
  const totalGoogle = campanhas.reduce((s, c) => s + c.leads, 0);

  if (campanhas.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-neutral-50 text-left text-[10px] uppercase tracking-wide text-neutral-500">
          <tr>
            <th className="px-4 py-3 font-medium">Campanha</th>
            <th className="px-4 py-3 text-right font-medium">Leads</th>
            <th className="px-4 py-3 text-right font-medium">% total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {campanhas.map((camp) => (
            <tr key={camp.id} className="hover:bg-neutral-50">
              <td className="px-4 py-3">
                <p className="truncate font-semibold text-neutral-900" title={camp.nome}>{camp.nome}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {[...camp.porFase].sort((a, b) => b.qtd - a.qtd).map((f) => {
                    const c =
                      f.fase.toLowerCase().includes("qualif") || f.fase.toLowerCase().includes("conclu")
                        ? "border-emerald-200 bg-emerald-50/60 text-emerald-700"
                        : f.fase.toLowerCase().includes("perd")
                        ? "border-red-200 bg-red-50/60 text-red-700"
                        : "border-neutral-200 bg-neutral-50 text-neutral-600";
                    return (
                      <span key={f.fase} className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${c}`}>
                        {f.fase} {f.qtd}
                      </span>
                    );
                  })}
                </div>
              </td>
              <td className="px-4 py-3 text-right font-semibold text-blue-700">{camp.leads}</td>
              <td className="px-4 py-3 text-right text-neutral-500">
                {totalGeral > 0 ? `${((camp.leads / totalGeral) * 100).toFixed(1)}%` : "—"}
              </td>
            </tr>
          ))}
          {totalGoogle < totalGeral && (
            <tr className="border-t border-dashed border-neutral-200 bg-neutral-50/30">
              <td className="px-4 py-2.5 text-xs italic text-neutral-400">Sem clique Google rastreado</td>
              <td className="px-4 py-2.5 text-right text-xs text-neutral-400">{totalGeral - totalGoogle}</td>
              <td className="px-4 py-2.5 text-right text-xs text-neutral-400">
                {totalGeral > 0 ? `${(((totalGeral - totalGoogle) / totalGeral) * 100).toFixed(1)}%` : "—"}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
