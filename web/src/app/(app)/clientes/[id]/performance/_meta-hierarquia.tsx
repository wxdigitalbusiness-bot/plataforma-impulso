"use client";

import { Fragment, useState } from "react";
import type { MetaCampanhaDB, MetaAdsetDB, MetaAdDB } from "@/lib/db-insights";
import { calcularSecundarios } from "@/lib/meta-result";

// ─── Helpers de formato ───────────────────────────────────────────────────────

function fBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
function fInt(v: number): string {
  return new Intl.NumberFormat("pt-BR").format(Math.round(v));
}
function r2(n: number) { return Math.round(n * 100) / 100; }

// ─── Ícone chevron ────────────────────────────────────────────────────────────

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

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  campanhas: MetaCampanhaDB[];
  adsets: MetaAdsetDB[];
  ads: MetaAdDB[];
  leadsMap: Map<string, number>;
  temCrm: boolean;
  totalLeadsCampanha: number;
};

// ─── Colunas da tabela ────────────────────────────────────────────────────────
// Nome | Resultado | Gasto | Cliques | CTR | CPC | Impressões | Alcance | Freq. | Leads CRM?

// ─── Componente principal ─────────────────────────────────────────────────────

export function MetaHierarquia({
  campanhas,
  adsets,
  ads,
  leadsMap,
  temCrm,
  totalLeadsCampanha,
}: Props) {
  const [expandedCamps,  setExpandedCamps]  = useState<Set<string>>(new Set());
  const [expandedAdsets, setExpandedAdsets] = useState<Set<string>>(new Set());

  // Índices
  const adsetsByCamp = new Map<string, MetaAdsetDB[]>();
  for (const a of adsets) {
    if (!adsetsByCamp.has(a.campanhaId)) adsetsByCamp.set(a.campanhaId, []);
    adsetsByCamp.get(a.campanhaId)!.push(a);
  }
  const adsByAdset = new Map<string, MetaAdDB[]>();
  for (const a of ads) {
    if (!adsByAdset.has(a.adsetId)) adsByAdset.set(a.adsetId, []);
    adsByAdset.get(a.adsetId)!.push(a);
  }

  function toggleCamp(id: string) {
    setExpandedCamps(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAdset(id: string) {
    setExpandedAdsets(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const mostrarLeads = temCrm && totalLeadsCampanha > 0;
  const colSpanTotal = 9 + (mostrarLeads ? 1 : 0);

  if (campanhas.length === 0) {
    return (
      <p className="rounded-xl border border-neutral-200 bg-white px-6 py-8 text-center text-sm text-neutral-500">
        Nenhuma campanha com dados no período.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
      <table className="w-full text-sm">

        {/* ── Cabeçalho ──────────────────────────────────────────────────── */}
        <thead className="bg-neutral-50 text-left text-[10px] uppercase tracking-wide text-neutral-500">
          <tr>
            <th className="px-4 py-3 font-medium">Nome</th>
            <th className="px-4 py-3 text-right font-medium">Resultado</th>
            <th className="px-4 py-3 text-right font-medium">Gasto</th>
            <th className="px-4 py-3 text-right font-medium">Cliques</th>
            <th className="px-4 py-3 text-right font-medium">CTR</th>
            <th className="px-4 py-3 text-right font-medium">CPC</th>
            <th className="px-4 py-3 text-right font-medium">Impressões</th>
            <th className="px-4 py-3 text-right font-medium">Alcance</th>
            <th className="px-4 py-3 text-right font-medium">Freq.</th>
            {mostrarLeads && (
              <th className="px-4 py-3 text-right font-medium text-violet-600">Leads CRM</th>
            )}
          </tr>
        </thead>

        <tbody className="divide-y divide-neutral-100">
          {campanhas.map((camp) => {
            const campOpen   = expandedCamps.has(camp.campanhaId);
            const campAdsets = adsetsByCamp.get(camp.campanhaId) ?? [];
            const leads      = leadsMap.get(camp.campanhaId) ?? 0;
            const custoRes   = camp.conversoes > 0 ? r2(camp.spend / camp.conversoes) : 0;

            return (
              <Fragment key={`frag-camp-${camp.campanhaId}`}>
                {/* ────── Linha de Campanha ────────────────────────── */}
                <tr
                  key={`c-${camp.campanhaId}`}
                  className="cursor-pointer hover:bg-neutral-50"
                  onClick={() => toggleCamp(camp.campanhaId)}
                >
                  {/* Nome */}
                  <td className="max-w-[260px] px-4 py-3">
                    <div className="flex items-start gap-2">
                      <span className="mt-1"><Chevron open={campOpen} /></span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-neutral-900" title={camp.campanhaNome}>
                          {camp.campanhaNome}
                        </p>
                        {campAdsets.length > 0 && (
                          <p className="text-[10px] text-neutral-400">
                            {campAdsets.length} conjunto{campAdsets.length > 1 ? "s" : ""}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Resultado */}
                  <td className="px-4 py-3 text-right">
                    {camp.conversoes > 0 ? (
                      <>
                        <p className="font-semibold text-neutral-900">{fInt(camp.conversoes)}</p>
                        <p className="text-[10px] text-neutral-400">{camp.tipoResultado}</p>
                        {custoRes > 0 && (
                          <p className="text-[10px] text-neutral-400">{fBRL(custoRes)}/res.</p>
                        )}
                        <Secundarios items={calcularSecundarios(
                          camp.objective, camp.campanhaNome,
                          camp.convPurchaseCount, camp.convMsgConversations,
                          camp.convLinkClicks,
                        )} />
                      </>
                    ) : (
                      <span className="text-neutral-300">—</span>
                    )}
                  </td>

                  {/* Gasto */}
                  <td className="px-4 py-3 text-right font-medium text-neutral-900">
                    {fBRL(camp.spend)}
                  </td>

                  {/* Cliques */}
                  <td className="px-4 py-3 text-right text-neutral-700">
                    {camp.cliques > 0 ? fInt(camp.cliques) : "—"}
                  </td>

                  {/* CTR */}
                  <td className="px-4 py-3 text-right text-neutral-600">
                    {camp.ctr > 0 ? `${camp.ctr.toFixed(2)}%` : "—"}
                  </td>

                  {/* CPC */}
                  <td className="px-4 py-3 text-right text-neutral-600">
                    {camp.cpc > 0 ? fBRL(camp.cpc) : "—"}
                  </td>

                  {/* Impressões */}
                  <td className="px-4 py-3 text-right text-neutral-600">
                    {fInt(camp.impressoes)}
                  </td>

                  {/* Alcance */}
                  <td className="px-4 py-3 text-right text-neutral-600">
                    {camp.reach > 0 ? fInt(camp.reach) : "—"}
                  </td>

                  {/* Frequência */}
                  <td className="px-4 py-3 text-right text-neutral-600">
                    {camp.frequencia > 0 ? `${camp.frequencia.toFixed(2)}×` : "—"}
                  </td>

                  {/* Leads CRM */}
                  {mostrarLeads && (
                    <td className="px-4 py-3 text-right">
                      {leads > 0
                        ? <span className="font-semibold text-violet-700">{fInt(leads)}</span>
                        : <span className="text-neutral-300">—</span>}
                    </td>
                  )}
                </tr>

                {/* ────── Conjuntos de anúncios ────────────────────── */}
                {campOpen && (
                  campAdsets.length === 0 ? (
                    <tr key={`no-adset-${camp.campanhaId}`}>
                      <td colSpan={colSpanTotal} className="bg-neutral-50/50 px-4 py-2 pl-12 text-xs text-neutral-400">
                        Dados de conjuntos e anúncios não disponíveis para este período.
                      </td>
                    </tr>
                  ) : campAdsets.map((adset) => {
                    const adsetOpen = expandedAdsets.has(adset.adsetId);
                    const adsetAds  = adsByAdset.get(adset.adsetId) ?? [];
                    const adsetCtr  = adset.impressoes > 0 ? r2((adset.cliques / adset.impressoes) * 100) : 0;
                    const adsetCpc  = adset.cliques > 0 ? r2(adset.spend / adset.cliques) : 0;
                    const adsetFreq = adset.reach > 0 ? r2(adset.impressoes / adset.reach) : 0;
                    const adsetCustoRes = adset.conversoes > 0 ? r2(adset.spend / adset.conversoes) : 0;

                    return (
                      <Fragment key={`frag-adset-${adset.adsetId}`}>
                        {/* Linha conjunto */}
                        <tr
                          key={`as-${adset.adsetId}`}
                          className="cursor-pointer bg-neutral-50/40 hover:bg-neutral-100/60"
                          onClick={(e) => { e.stopPropagation(); toggleAdset(adset.adsetId); }}
                        >
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2 pl-7">
                              <span className="h-3.5 w-px rounded-full bg-neutral-200" />
                              <Chevron open={adsetOpen} />
                              <div className="min-w-0">
                                <p className="truncate text-xs font-medium text-neutral-700" title={adset.adsetNome}>
                                  {adset.adsetNome}
                                </p>
                                <p className="text-[10px] text-neutral-400">
                                  Conjunto · {adsetAds.length} anúncio{adsetAds.length !== 1 ? "s" : ""}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {adset.conversoes > 0 ? (
                              <>
                                <p className="text-xs font-semibold text-neutral-800">{fInt(adset.conversoes)}</p>
                                <p className="text-[10px] text-neutral-400">{adset.tipoResultado}</p>
                                {adsetCustoRes > 0 && (
                                  <p className="text-[10px] text-neutral-400">{fBRL(adsetCustoRes)}/res.</p>
                                )}
                                <Secundarios items={calcularSecundarios(
                                  adset.objective, adset.campanhaNome,
                                  adset.convPurchaseCount, adset.convMsgConversations,
                                  adset.convLinkClicks,
                                )} />
                              </>
                            ) : (
                              <span className="text-neutral-300 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right text-xs font-medium text-neutral-700">{fBRL(adset.spend)}</td>
                          <td className="px-4 py-2.5 text-right text-xs text-neutral-600">{adset.cliques > 0 ? fInt(adset.cliques) : "—"}</td>
                          <td className="px-4 py-2.5 text-right text-xs text-neutral-500">{adsetCtr > 0 ? `${adsetCtr.toFixed(2)}%` : "—"}</td>
                          <td className="px-4 py-2.5 text-right text-xs text-neutral-500">{adsetCpc > 0 ? fBRL(adsetCpc) : "—"}</td>
                          <td className="px-4 py-2.5 text-right text-xs text-neutral-600">{fInt(adset.impressoes)}</td>
                          <td className="px-4 py-2.5 text-right text-xs text-neutral-500">{adset.reach > 0 ? fInt(adset.reach) : "—"}</td>
                          <td className="px-4 py-2.5 text-right text-xs text-neutral-500">{adsetFreq > 0 ? `${adsetFreq.toFixed(2)}×` : "—"}</td>
                          {mostrarLeads && <td className="px-4 py-2.5 text-right text-neutral-300 text-xs">—</td>}
                        </tr>

                        {/* ────── Anúncios ──────────────────────────── */}
                        {adsetOpen && adsetAds.map((ad) => {
                          const adCtr = ad.impressoes > 0 ? r2((ad.cliques / ad.impressoes) * 100) : 0;
                          const adCpc = ad.cliques > 0 ? r2(ad.spend / ad.cliques) : 0;
                          const adCustoRes = ad.conversoes > 0 ? r2(ad.spend / ad.conversoes) : 0;
                          return (
                            <tr key={`ad-${ad.adId}`} className="bg-neutral-50/20 hover:bg-neutral-50">
                              <td className="px-4 py-2">
                                <div className="flex items-center gap-2 pl-16">
                                  <span className="h-3 w-px rounded-full bg-neutral-200" />
                                  <div className="min-w-0">
                                    <p className="truncate text-xs text-neutral-700" title={ad.adNome}>
                                      {ad.adNome}
                                    </p>
                                    <p className="text-[10px] text-neutral-400">Anúncio</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-2 text-right">
                                {ad.conversoes > 0 ? (
                                  <>
                                    <p className="text-xs font-semibold text-neutral-800">{fInt(ad.conversoes)}</p>
                                    <p className="text-[10px] text-neutral-400">{ad.tipoResultado}</p>
                                    {adCustoRes > 0 && (
                                      <p className="text-[10px] text-neutral-400">{fBRL(adCustoRes)}/res.</p>
                                    )}
                                    <Secundarios items={calcularSecundarios(
                                      ad.objective, ad.campanhaNome,
                                      ad.convPurchaseCount, ad.convMsgConversations,
                                      ad.convLinkClicks,
                                    )} />
                                  </>
                                ) : (
                                  <span className="text-neutral-300 text-xs">—</span>
                                )}
                              </td>
                              <td className="px-4 py-2 text-right text-xs text-neutral-700">{fBRL(ad.spend)}</td>
                              <td className="px-4 py-2 text-right text-xs text-neutral-600">{ad.cliques > 0 ? fInt(ad.cliques) : "—"}</td>
                              <td className="px-4 py-2 text-right text-xs text-neutral-500">{adCtr > 0 ? `${adCtr.toFixed(2)}%` : "—"}</td>
                              <td className="px-4 py-2 text-right text-xs text-neutral-500">{adCpc > 0 ? fBRL(adCpc) : "—"}</td>
                              <td className="px-4 py-2 text-right text-xs text-neutral-600">{fInt(ad.impressoes)}</td>
                              <td className="px-4 py-2 text-right text-xs text-neutral-500">{ad.reach > 0 ? fInt(ad.reach) : "—"}</td>
                              <td className="px-4 py-2" />
                              {mostrarLeads && <td className="px-4 py-2" />}
                            </tr>
                          );
                        })}
                      </Fragment>
                    );
                  })
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Secundários (resultados extras com valor > 0) ────────────────────────────

function Secundarios({ items }: { items: Array<{ tipoResultado: string; conversoes: number }> }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-1 space-y-0.5 border-t border-neutral-100 pt-1">
      {items.map((s) => (
        <p key={s.tipoResultado} className="text-[10px] text-neutral-400">
          + {fInt(s.conversoes)} {s.tipoResultado.toLowerCase()}
        </p>
      ))}
    </div>
  );
}
