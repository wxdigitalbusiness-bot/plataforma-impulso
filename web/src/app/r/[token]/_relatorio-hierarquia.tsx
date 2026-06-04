"use client";

import { Fragment, useState } from "react";
import type {
  CampanhaSnapshot, AdsetSnapshot, AdSnapshot,
} from "@/lib/meta-snapshot";

function fBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
function fInt(v: number) {
  return new Intl.NumberFormat("pt-BR").format(Math.round(v));
}

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

type Props = {
  campanhas: CampanhaSnapshot[];
  adsets:    AdsetSnapshot[];
  ads:       AdSnapshot[];
};

export function RelatorioHierarquia({ campanhas, adsets, ads }: Props) {
  const [openCamps,  setOpenCamps]  = useState<Set<string>>(new Set());
  const [openAdsets, setOpenAdsets] = useState<Set<string>>(new Set());

  const adsetsByCamp = new Map<string, AdsetSnapshot[]>();
  for (const a of adsets) {
    if (!adsetsByCamp.has(a.campaignId)) adsetsByCamp.set(a.campaignId, []);
    adsetsByCamp.get(a.campaignId)!.push(a);
  }
  const adsByAdset = new Map<string, AdSnapshot[]>();
  for (const a of ads) {
    if (!adsByAdset.has(a.adsetId)) adsByAdset.set(a.adsetId, []);
    adsByAdset.get(a.adsetId)!.push(a);
  }

  function toggleCamp(id: string) {
    setOpenCamps((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAdset(id: string) {
    setOpenAdsets((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

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
        <thead className="bg-neutral-50 text-left text-[10px] uppercase tracking-wide text-neutral-500">
          <tr>
            <th className="px-4 py-3 font-medium">Nome</th>
            <th className="px-4 py-3 text-right font-medium">Resultado</th>
            <th className="px-4 py-3 text-right font-medium">Gasto</th>
            <th className="px-4 py-3 text-right font-medium">Alcance</th>
            <th className="px-4 py-3 text-right font-medium">Cliques</th>
            <th className="px-4 py-3 text-right font-medium">CTR</th>
            <th className="px-4 py-3 text-right font-medium">CPC</th>
            <th className="px-4 py-3 text-right font-medium">Impressões</th>
            <th className="px-4 py-3 text-right font-medium">Freq.</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-neutral-100">
          {campanhas.map((camp) => {
            const campOpen   = openCamps.has(camp.campaignId);
            const campAdsets = adsetsByCamp.get(camp.campaignId) ?? [];
            return (
              <Fragment key={`c-${camp.campaignId}`}>
                <tr
                  className="cursor-pointer hover:bg-neutral-50"
                  onClick={() => toggleCamp(camp.campaignId)}
                >
                  <td className="max-w-[260px] px-4 py-3">
                    <div className="flex items-start gap-2">
                      <span className="mt-1"><Chevron open={campOpen} /></span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-neutral-900" title={camp.campaignName}>
                          {camp.campaignName}
                        </p>
                        {campAdsets.length > 0 && (
                          <p className="text-[10px] text-neutral-400">
                            {campAdsets.length} conjunto{campAdsets.length > 1 ? "s" : ""}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <Resultado res={camp.resultado} secundarias={camp.secundarias} />
                  <td className="px-4 py-3 text-right font-medium text-neutral-900">{fBRL(camp.spend)}</td>
                  <td className="px-4 py-3 text-right text-neutral-700">{camp.reach > 0 ? fInt(camp.reach) : "—"}</td>
                  <td className="px-4 py-3 text-right text-neutral-700">{camp.clicks > 0 ? fInt(camp.clicks) : "—"}</td>
                  <td className="px-4 py-3 text-right text-neutral-600">{camp.ctr > 0 ? `${camp.ctr.toFixed(2)}%` : "—"}</td>
                  <td className="px-4 py-3 text-right text-neutral-600">{camp.cpc > 0 ? fBRL(camp.cpc) : "—"}</td>
                  <td className="px-4 py-3 text-right text-neutral-600">{fInt(camp.impressions)}</td>
                  <td className="px-4 py-3 text-right text-neutral-600">{camp.frequency > 0 ? `${camp.frequency.toFixed(2)}×` : "—"}</td>
                </tr>

                {campOpen && (campAdsets.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="bg-neutral-50/50 px-4 py-2 pl-12 text-xs text-neutral-400">
                      Sem conjuntos no período.
                    </td>
                  </tr>
                ) : campAdsets.map((adset) => {
                  const adsetOpen = openAdsets.has(adset.adsetId);
                  const adsetAds  = adsByAdset.get(adset.adsetId) ?? [];
                  return (
                    <Fragment key={`as-${adset.adsetId}`}>
                      <tr
                        className="cursor-pointer bg-neutral-50/40 hover:bg-neutral-100/60"
                        onClick={(e) => { e.stopPropagation(); toggleAdset(adset.adsetId); }}
                      >
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2 pl-7">
                            <span className="h-3.5 w-px rounded-full bg-neutral-200" />
                            <Chevron open={adsetOpen} />
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium text-neutral-700" title={adset.adsetName}>
                                {adset.adsetName}
                              </p>
                              <p className="text-[10px] text-neutral-400">
                                Conjunto · {adsetAds.length} anúncio{adsetAds.length !== 1 ? "s" : ""}
                              </p>
                            </div>
                          </div>
                        </td>
                        <Resultado res={adset.resultado} secundarias={adset.secundarias} compact />
                        <td className="px-4 py-2.5 text-right text-xs font-medium text-neutral-700">{fBRL(adset.spend)}</td>
                        <td className="px-4 py-2.5 text-right text-xs text-neutral-600">{adset.reach > 0 ? fInt(adset.reach) : "—"}</td>
                        <td className="px-4 py-2.5 text-right text-xs text-neutral-600">{adset.clicks > 0 ? fInt(adset.clicks) : "—"}</td>
                        <td className="px-4 py-2.5 text-right text-xs text-neutral-500">{adset.ctr > 0 ? `${adset.ctr.toFixed(2)}%` : "—"}</td>
                        <td className="px-4 py-2.5 text-right text-xs text-neutral-500">{adset.cpc > 0 ? fBRL(adset.cpc) : "—"}</td>
                        <td className="px-4 py-2.5 text-right text-xs text-neutral-600">{fInt(adset.impressions)}</td>
                        <td className="px-4 py-2.5 text-right text-xs text-neutral-500">{adset.frequency > 0 ? `${adset.frequency.toFixed(2)}×` : "—"}</td>
                      </tr>

                      {adsetOpen && adsetAds.map((ad) => (
                        <tr key={`ad-${ad.adId}`} className="bg-neutral-50/20 hover:bg-neutral-50">
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2 pl-16">
                              <span className="h-3 w-px rounded-full bg-neutral-200" />
                              <div className="min-w-0">
                                <p className="truncate text-xs text-neutral-700" title={ad.adName}>
                                  {ad.adName}
                                </p>
                                <p className="text-[10px] text-neutral-400">Anúncio</p>
                              </div>
                            </div>
                          </td>
                          <Resultado res={ad.resultado} secundarias={ad.secundarias} compact />
                          <td className="px-4 py-2 text-right text-xs text-neutral-700">{fBRL(ad.spend)}</td>
                          <td className="px-4 py-2 text-right text-xs text-neutral-600">{ad.reach > 0 ? fInt(ad.reach) : "—"}</td>
                          <td className="px-4 py-2 text-right text-xs text-neutral-600">{ad.clicks > 0 ? fInt(ad.clicks) : "—"}</td>
                          <td className="px-4 py-2 text-right text-xs text-neutral-500">{ad.ctr > 0 ? `${ad.ctr.toFixed(2)}%` : "—"}</td>
                          <td className="px-4 py-2 text-right text-xs text-neutral-500">{ad.cpc > 0 ? fBRL(ad.cpc) : "—"}</td>
                          <td className="px-4 py-2 text-right text-xs text-neutral-600">{fInt(ad.impressions)}</td>
                          <td className="px-4 py-2 text-right text-xs text-neutral-500">{ad.frequency > 0 ? `${ad.frequency.toFixed(2)}×` : "—"}</td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                }))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Resultado({
  res,
  secundarias = [],
  compact = false,
}: {
  res: { label: string; valor: number; custoPorResultado: number } | null;
  secundarias?: Array<{ label: string; valor: number }>;
  compact?: boolean;
}) {
  const temSec = secundarias.length > 0;
  if (!res || res.valor <= 0) {
    if (!temSec) {
      return <td className={`px-4 text-right ${compact ? "py-2.5" : "py-3"}`}><span className={`${compact ? "text-xs" : ""} text-neutral-300`}>—</span></td>;
    }
    return (
      <td className={`px-4 text-right ${compact ? "py-2.5" : "py-3"}`}>
        {secundarias.map((s) => (
          <p key={s.label} className="text-[10px] text-neutral-400">
            {fInt(s.valor)} {s.label.toLowerCase()}
          </p>
        ))}
      </td>
    );
  }
  return (
    <td className={`px-4 text-right ${compact ? "py-2.5" : "py-3"}`}>
      <p className={`font-semibold text-neutral-900 ${compact ? "text-xs" : ""}`}>{fInt(res.valor)}</p>
      <p className="text-[10px] text-neutral-400">{res.label}</p>
      {res.custoPorResultado > 0 && (
        <p className="text-[10px] text-neutral-400">{fBRL(res.custoPorResultado)}/res.</p>
      )}
      {temSec && (
        <div className="mt-1 space-y-0.5 border-t border-neutral-100 pt-1">
          {secundarias.map((s) => (
            <p key={s.label} className="text-[10px] text-neutral-400">
              + {fInt(s.valor)} {s.label.toLowerCase()}
            </p>
          ))}
        </div>
      )}
    </td>
  );
}
