"use client";

import { Fragment, useState } from "react";
import type { LeadAtribuicaoDetalhe } from "@/lib/db-insights";

// ── Cores por fase ────────────────────────────────────────────────────────────
function faseCores(fase: string): { border: string; label: string; value: string } {
  const l = fase.toLowerCase();
  if (l.includes("qualif") || l.includes("conclu"))
    return { border: "border-emerald-200 bg-emerald-50/60", label: "text-emerald-600", value: "text-emerald-700" };
  if (l.includes("negoci"))
    return { border: "border-blue-200 bg-blue-50/60", label: "text-blue-500", value: "text-blue-700" };
  if (l.includes("perd"))
    return { border: "border-red-200 bg-red-50/60", label: "text-red-500", value: "text-red-700" };
  if (l === "leads")
    return { border: "border-neutral-200 bg-neutral-50", label: "text-neutral-400", value: "text-neutral-700" };
  return { border: "border-neutral-200 bg-white", label: "text-neutral-400", value: "text-neutral-600" };
}

// ── Ícone ─────────────────────────────────────────────────────────────────────
function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-3.5 w-3.5 shrink-0 text-neutral-400 transition-transform duration-150 ${open ? "rotate-90" : ""}`}
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

// ── Mini card de fase (mesmo estilo que KpiCard da performance) ───────────────
function FaseCard({ fase, qtd }: { fase: string; qtd: number }) {
  const c = faseCores(fase);
  return (
    <div className={`rounded-lg border px-2.5 py-1.5 ${c.border}`}>
      <p className={`text-[9px] uppercase tracking-wide font-medium ${c.label}`}>{fase}</p>
      <p className={`mt-0.5 text-sm font-semibold tabular-nums ${c.value}`}>{qtd}</p>
    </div>
  );
}

// ── Tipos ─────────────────────────────────────────────────────────────────────
type PorFase = Array<{ fase: string; qtd: number }>;

type AdAgregado = {
  adId: string;
  adNome: string;
  leads: number;
  porFase: PorFase;
};

type AdsetAgregado = {
  adsetId: string;
  adsetNome: string;
  leads: number;
  porFase: PorFase;
  ads: AdAgregado[];
};

type CampanhaAgregada = {
  campanhaId: string;
  campanhaNome: string;
  leads: number;
  porFase: PorFase;
  adsets: AdsetAgregado[];
};

// ── Funções auxiliares ────────────────────────────────────────────────────────
function mergeFase(dest: PorFase, fase: string, qtd: number) {
  const existing = dest.find((f) => f.fase === fase);
  if (existing) existing.qtd += qtd;
  else dest.push({ fase, qtd });
}

function sortFase(pf: PorFase): PorFase {
  const ORDER = ["Qualificado", "Qualificados", "Em Negociação", "Em Negociacao",
    "Concluido", "Concluído", "Perdido", "Leads", "Desconhecido"];
  return [...pf].sort((a, b) => {
    const ia = ORDER.indexOf(a.fase);
    const ib = ORDER.indexOf(b.fase);
    if (ia === -1 && ib === -1) return b.qtd - a.qtd;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

function agrupar(dados: LeadAtribuicaoDetalhe[]): CampanhaAgregada[] {
  const campMap = new Map<string, CampanhaAgregada>();

  for (const d of dados) {
    // Campanha
    if (!campMap.has(d.campanhaId)) {
      campMap.set(d.campanhaId, {
        campanhaId: d.campanhaId, campanhaNome: d.campanhaNome,
        leads: 0, porFase: [], adsets: [],
      });
    }
    const camp = campMap.get(d.campanhaId)!;
    camp.leads += d.leads;
    mergeFase(camp.porFase, d.fase, d.leads);

    // Adset
    let adset = camp.adsets.find((a) => a.adsetId === d.adsetId);
    if (!adset) {
      adset = { adsetId: d.adsetId, adsetNome: d.adsetNome, leads: 0, porFase: [], ads: [] };
      camp.adsets.push(adset);
    }
    adset.leads += d.leads;
    mergeFase(adset.porFase, d.fase, d.leads);

    // Ad
    let ad = adset.ads.find((a) => a.adId === d.adId);
    if (!ad) {
      ad = { adId: d.adId, adNome: d.adNome, leads: 0, porFase: [] };
      adset.ads.push(ad);
    }
    ad.leads += d.leads;
    mergeFase(ad.porFase, d.fase, d.leads);
  }

  // Ordenar
  const campanhas = [...campMap.values()].sort((a, b) => b.leads - a.leads);
  for (const c of campanhas) {
    c.porFase = sortFase(c.porFase);
    c.adsets.sort((a, b) => b.leads - a.leads);
    for (const a of c.adsets) {
      a.porFase = sortFase(a.porFase);
      a.ads.sort((x, y) => y.leads - x.leads);
      for (const ad of a.ads) {
        ad.porFase = sortFase(ad.porFase);
      }
    }
  }
  return campanhas;
}

// ── Componente principal ──────────────────────────────────────────────────────
type Props = {
  dados: LeadAtribuicaoDetalhe[];
  totalLeads: number;   // leads COM atribuição
  totalGeral: number;   // total do período (incluindo sem atribuição)
};

export function LeadsAtribuicao({ dados, totalLeads, totalGeral }: Props) {
  const campanhas = agrupar(dados);
  const semAtribuicao = totalGeral - totalLeads;
  const [expandedCamps,  setExpandedCamps]  = useState<Set<string>>(new Set());
  const [expandedAdsets, setExpandedAdsets] = useState<Set<string>>(new Set());

  if (campanhas.length === 0) return null;

  function toggleCamp(id: string) {
    setExpandedCamps((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAdset(id: string) {
    setExpandedAdsets((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function pct(leads: number) {
    return totalLeads > 0 ? `${((leads / totalLeads) * 100).toFixed(1)}%` : "—";
  }

  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-neutral-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-neutral-50 text-left text-[10px] uppercase tracking-wide text-neutral-500">
          <tr>
            <th className="px-4 py-3 font-medium">Atribuição CRM</th>
            <th className="px-4 py-3 text-right font-medium">Leads</th>
            <th className="px-4 py-3 text-right font-medium">% total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {campanhas.map((camp) => {
            const campOpen = expandedCamps.has(camp.campanhaId);
            return (
              <Fragment key={`camp-${camp.campanhaId}`}>
                {/* ── Campanha ── */}
                <tr
                  className="cursor-pointer hover:bg-neutral-50"
                  onClick={() => toggleCamp(camp.campanhaId)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Chevron open={campOpen} />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-neutral-900" title={camp.campanhaNome}>
                          {camp.campanhaNome}
                        </p>
                        <p className="mt-0.5 text-[10px] text-neutral-400">
                          Campanha · {camp.adsets.length} conjunto{camp.adsets.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {camp.porFase.map((f) => (
                          <FaseCard key={f.fase} fase={f.fase} qtd={f.qtd} />
                        ))}
                      </div>
                      <span className="min-w-[1.5rem] text-right font-semibold text-violet-700">{camp.leads}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-500">
                    {pct(camp.leads)}
                  </td>
                </tr>

                {/* ── Conjuntos ── */}
                {campOpen && camp.adsets.map((adset) => {
                  const adsetOpen = expandedAdsets.has(adset.adsetId);
                  return (
                    <Fragment key={`adset-${adset.adsetId}`}>
                      <tr
                        className="cursor-pointer bg-neutral-50/40 hover:bg-neutral-100/60"
                        onClick={(e) => { e.stopPropagation(); toggleAdset(adset.adsetId); }}
                      >
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2 pl-7">
                            <span className="h-3.5 w-px shrink-0 rounded-full bg-neutral-200" />
                            <Chevron open={adsetOpen} />
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium text-neutral-700" title={adset.adsetNome}>
                                {adset.adsetNome}
                              </p>
                              <p className="mt-0.5 text-[10px] text-neutral-400">
                                Conjunto · {adset.ads.length} anúncio{adset.ads.length !== 1 ? "s" : ""}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-end gap-2">
                            <div className="flex flex-wrap justify-end gap-1.5">
                              {adset.porFase.map((f) => (
                                <FaseCard key={f.fase} fase={f.fase} qtd={f.qtd} />
                              ))}
                            </div>
                            <span className="min-w-[1.5rem] text-right text-xs font-semibold text-violet-600">{adset.leads}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs text-neutral-400">
                          {pct(adset.leads)}
                        </td>
                      </tr>

                      {/* ── Anúncios ── */}
                      {adsetOpen && adset.ads.map((ad) => (
                        <tr key={`ad-${ad.adId}`} className="bg-neutral-50/20 hover:bg-neutral-50">
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2 pl-16">
                              <span className="h-3 w-px shrink-0 rounded-full bg-neutral-200" />
                              <div className="min-w-0">
                                <p className="truncate text-xs text-neutral-700" title={ad.adNome}>
                                  {ad.adNome}
                                </p>
                                <p className="mt-0.5 text-[10px] text-neutral-400">Anúncio</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex items-center justify-end gap-2">
                              <div className="flex flex-wrap justify-end gap-1.5">
                                {ad.porFase.map((f) => (
                                  <FaseCard key={f.fase} fase={f.fase} qtd={f.qtd} />
                                ))}
                              </div>
                              <span className="min-w-[1.5rem] text-right text-xs font-medium text-violet-500">{ad.leads}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2 text-right text-xs text-neutral-400">
                            {pct(ad.leads)}
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
              </Fragment>
            );
          })}

          {/* ── Sem atribuição ── */}
          {semAtribuicao > 0 && (
            <tr className="border-t border-dashed border-neutral-200 bg-neutral-50/30">
              <td className="px-4 py-2.5 text-xs text-neutral-400 italic">
                Sem atribuição de anúncio (orgânico / Google Ads / sem rastreamento)
              </td>
              <td className="px-4 py-2.5 text-right text-xs text-neutral-400">{semAtribuicao}</td>
              <td className="px-4 py-2.5 text-right text-xs text-neutral-400">
                {totalGeral > 0 ? `${((semAtribuicao / totalGeral) * 100).toFixed(1)}%` : "—"}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
