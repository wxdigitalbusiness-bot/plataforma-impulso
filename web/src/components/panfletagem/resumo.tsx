import type { PanfletagemInsightsDB } from "@/lib/db-insights";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fInt(v: number): string {
  return new Intl.NumberFormat("pt-BR").format(Math.round(v));
}

function detectarFormato(nome: string): string {
  const n = nome.toUpperCase();
  if (/\bIMG\b|\bIMAGEM\b|\bIMAGE\b/.test(n)) return "Imagem";
  if (/\bVDO\b|\bVÍDEO\b|\bVIDEO\b|\bVID\b/.test(n)) return "Vídeo";
  if (/\bCAR\b|\bCARROSSEL\b|\bCAROUSEL\b/.test(n)) return "Carrossel";
  if (/\bSTORY\b|\bSTORIES\b/.test(n)) return "Story";
  return "—";
}

// ─── Tipos internos ───────────────────────────────────────────────────────────

type Cor = "blue" | "indigo" | "violet" | "emerald" | "green";

const corClasses: Record<Cor, { border: string; label: string; valor: string }> = {
  blue:    { border: "border-blue-200",    label: "text-blue-600",    valor: "text-blue-800"    },
  indigo:  { border: "border-indigo-200",  label: "text-indigo-600",  valor: "text-indigo-800"  },
  violet:  { border: "border-violet-200",  label: "text-violet-600",  valor: "text-violet-800"  },
  emerald: { border: "border-emerald-200", label: "text-emerald-600", valor: "text-emerald-800" },
  green:   { border: "border-green-200",   label: "text-green-600",   valor: "text-green-800"   },
};

// ─── Componentes internos ─────────────────────────────────────────────────────

function PanfKpiCard({
  icon, label, valor, cor,
}: {
  icon: string;
  label: string;
  valor: string;
  cor: Cor;
}) {
  const cls = corClasses[cor];
  return (
    <div className={`rounded-xl border ${cls.border} bg-white p-4`}>
      <p className={`flex items-center gap-1 text-[10px] uppercase tracking-wide ${cls.label}`}>
        <span>{icon}</span> {label}
      </p>
      <p className={`mt-1 text-xl font-semibold ${cls.valor}`}>{valor}</p>
    </div>
  );
}

// ─── PanfletagemResumo ────────────────────────────────────────────────────────

/**
 * Exibe as 5 métricas principais de Panfletagem Digital + breakdown por anúncio.
 * Usado tanto na página de performance interna quanto no relatório público.
 *
 * Props:
 *  - dados: resultado de getPanfletagemInsights()
 *  - seguidores: delta de seguidores do Instagram no período (do snapshot ou IG Insights)
 */
export function PanfletagemResumo({
  dados,
  seguidores = null,
}: {
  dados: PanfletagemInsightsDB;
  seguidores?: number | null;
}) {
  const seguidoresStr =
    seguidores !== null
      ? seguidores >= 0
        ? `+${fInt(seguidores)}`
        : fInt(seguidores)
      : "—";

  const kpis: Array<{ icon: string; label: string; valor: string; cor: Cor }> = [
    { icon: "👁",  label: "Visualizações",     valor: fInt(dados.impressoes),    cor: "blue"    },
    { icon: "📡", label: "Alcance",            valor: fInt(dados.alcance),       cor: "indigo"  },
    { icon: "👤", label: "Visitas ao Perfil",  valor: fInt(dados.visitasPerfil), cor: "violet"  },
    { icon: "🎉", label: "Seguidores Ganhos",  valor: seguidoresStr,             cor: "emerald" },
    { icon: "💬", label: "Conversas WhatsApp", valor: fInt(dados.conversas),     cor: "green"   },
  ];

  return (
    <div className="space-y-4">
      {/* ── KPI cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((k) => (
          <PanfKpiCard key={k.label} icon={k.icon} label={k.label} valor={k.valor} cor={k.cor} />
        ))}
      </div>

      {/* ── Tabela por anúncio ────────────────────────────────────── */}
      {dados.ads.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-3">Anúncio</th>
                <th className="px-4 py-3">Formato</th>
                <th className="px-4 py-3 text-right">Visualizações</th>
                <th className="px-4 py-3 text-right">Alcance</th>
                <th className="px-4 py-3 text-right">Visitas Perfil</th>
                <th className="px-4 py-3 text-right">Conversas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {dados.ads.map((ad) => (
                <tr key={ad.adId} className="hover:bg-neutral-50">
                  <td className="max-w-[260px] px-4 py-3 font-medium text-neutral-900">
                    <span className="block truncate" title={ad.adNome}>
                      {ad.adNome}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-500">
                    {detectarFormato(ad.adNome)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-blue-700">
                    {fInt(ad.impressoes)}
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-700">
                    {fInt(ad.alcance)}
                  </td>
                  <td className="px-4 py-3 text-right text-violet-700">
                    {ad.visitasPerfil > 0 ? fInt(ad.visitasPerfil) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-green-700">
                    {ad.conversas > 0 ? fInt(ad.conversas) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-neutral-200 bg-neutral-50/80">
              <tr>
                <td colSpan={2} className="px-4 py-3 font-semibold text-neutral-700">
                  Total
                </td>
                <td className="px-4 py-3 text-right font-bold text-blue-700">
                  {fInt(dados.impressoes)}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-neutral-700">
                  {fInt(dados.alcance)}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-violet-700">
                  {dados.visitasPerfil > 0 ? fInt(dados.visitasPerfil) : "—"}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-green-700">
                  {dados.conversas > 0 ? fInt(dados.conversas) : "—"}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-neutral-200 bg-white px-6 py-10 text-center text-sm text-neutral-500">
          Sem dados de anúncios no período.
        </div>
      )}
    </div>
  );
}
