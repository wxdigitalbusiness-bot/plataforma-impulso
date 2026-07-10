import { getPortalSession } from "@/lib/portal-session";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type Row = {
  date: Date;
  campaign_name: string;
  campaign_type: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  cost_per_conv: number;
};

function fmtBrl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmt(n: number) {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 0 });
}

export default async function PortalGooglePage() {
  const session = await getPortalSession();
  if (!session) redirect("/portal/login");

  if (!session.clientKey) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-400">
        Conta sem dados de Google Ads configurados.
      </div>
    );
  }

  const rows = await db.$queryRaw<Row[]>`
    SELECT date, campaign_name, campaign_type, spend, impressions, clicks, conversions, cost_per_conv
    FROM google_ads_insights
    WHERE client_key = ${session.clientKey}
    ORDER BY date DESC
    LIMIT 200
  `;

  const totals = rows.reduce(
    (acc, r) => ({
      spend: acc.spend + Number(r.spend),
      impressions: acc.impressions + Number(r.impressions),
      clicks: acc.clicks + Number(r.clicks),
      conversions: acc.conversions + Number(r.conversions),
    }),
    { spend: 0, impressions: 0, clicks: 0, conversions: 0 }
  );

  const cpc = totals.clicks ? totals.spend / totals.clicks : 0;
  const cpconv = totals.conversions ? totals.spend / totals.conversions : 0;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-neutral-900">Google Ads</h2>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Investimento", value: fmtBrl(totals.spend) },
          { label: "Impressões", value: fmt(totals.impressions) },
          { label: "Cliques", value: fmt(totals.clicks) },
          { label: "Conversões", value: fmt(totals.conversions) },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-neutral-200 bg-white p-4">
            <p className="text-xs text-neutral-400">{k.label}</p>
            <p className="mt-1 text-xl font-bold text-neutral-900">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {[
          { label: "CPC médio", value: fmtBrl(cpc) },
          { label: "Custo por conversão", value: fmtBrl(cpconv) },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-neutral-200 bg-white p-4">
            <p className="text-xs text-neutral-400">{k.label}</p>
            <p className="mt-1 text-xl font-bold text-neutral-900">{k.value}</p>
          </div>
        ))}
      </div>

      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-100 text-xs text-neutral-500">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Data</th>
                <th className="px-4 py-3 text-left font-medium">Campanha</th>
                <th className="px-4 py-3 text-right font-medium">Investido</th>
                <th className="px-4 py-3 text-right font-medium">Cliques</th>
                <th className="px-4 py-3 text-right font-medium">Conversões</th>
                <th className="px-4 py-3 text-right font-medium">Custo/conv</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-neutral-50">
                  <td className="px-4 py-2.5 text-neutral-500 whitespace-nowrap">
                    {new Date(r.date).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-neutral-800 max-w-[200px] truncate">
                    {r.campaign_name}
                  </td>
                  <td className="px-4 py-2.5 text-right">{fmtBrl(Number(r.spend))}</td>
                  <td className="px-4 py-2.5 text-right">{fmt(Number(r.clicks))}</td>
                  <td className="px-4 py-2.5 text-right">{fmt(Number(r.conversions))}</td>
                  <td className="px-4 py-2.5 text-right">{fmtBrl(Number(r.cost_per_conv))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-400">
          Sem dados de campanhas disponíveis.
        </div>
      )}
    </div>
  );
}
