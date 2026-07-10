import { getPortalSession } from "@/lib/portal-session";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type Row = {
  date: Date;
  campaign_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  conv_msg_conversations: number;
};

type Totals = {
  spend: number;
  impressions: number;
  clicks: number;
  conversas: number;
};

function fmt(n: number, prefix = "") {
  return prefix + n.toLocaleString("pt-BR", { minimumFractionDigits: 0 });
}
function fmtBrl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function PortalMetaPage() {
  const session = await getPortalSession();
  if (!session) redirect("/portal/login");

  if (!session.clientKey) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-400">
        Conta sem dados de Meta Ads configurados.
      </div>
    );
  }

  const rows = await db.$queryRaw<Row[]>`
    SELECT date, campaign_name, spend, impressions, clicks, conv_msg_conversations
    FROM fb_meta_insights
    WHERE client_key = ${session.clientKey}
    ORDER BY date DESC
    LIMIT 200
  `;

  const totals: Totals = rows.reduce(
    (acc, r) => ({
      spend: acc.spend + Number(r.spend),
      impressions: acc.impressions + Number(r.impressions),
      clicks: acc.clicks + Number(r.clicks),
      conversas: acc.conversas + Number(r.conv_msg_conversations),
    }),
    { spend: 0, impressions: 0, clicks: 0, conversas: 0 }
  );

  const ctr = totals.impressions ? (totals.clicks / totals.impressions) * 100 : 0;
  const cpc = totals.clicks ? totals.spend / totals.clicks : 0;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-neutral-900">Meta Ads</h2>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Investimento", value: fmtBrl(totals.spend) },
          { label: "Impressões", value: fmt(totals.impressions) },
          { label: "Cliques", value: fmt(totals.clicks) },
          { label: "Conversas iniciadas", value: fmt(totals.conversas) },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-neutral-200 bg-white p-4">
            <p className="text-xs text-neutral-400">{k.label}</p>
            <p className="mt-1 text-xl font-bold text-neutral-900">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
        {[
          { label: "CTR", value: ctr.toFixed(2) + "%" },
          { label: "CPC médio", value: fmtBrl(cpc) },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-neutral-200 bg-white p-4">
            <p className="text-xs text-neutral-400">{k.label}</p>
            <p className="mt-1 text-xl font-bold text-neutral-900">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Tabela por campanha */}
      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-100 text-xs text-neutral-500">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Data</th>
                <th className="px-4 py-3 text-left font-medium">Campanha</th>
                <th className="px-4 py-3 text-right font-medium">Investido</th>
                <th className="px-4 py-3 text-right font-medium">Impressões</th>
                <th className="px-4 py-3 text-right font-medium">Cliques</th>
                <th className="px-4 py-3 text-right font-medium">Conversas</th>
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
                  <td className="px-4 py-2.5 text-right text-neutral-700">
                    {fmtBrl(Number(r.spend))}
                  </td>
                  <td className="px-4 py-2.5 text-right text-neutral-700">
                    {fmt(Number(r.impressions))}
                  </td>
                  <td className="px-4 py-2.5 text-right text-neutral-700">
                    {fmt(Number(r.clicks))}
                  </td>
                  <td className="px-4 py-2.5 text-right text-neutral-700">
                    {fmt(Number(r.conv_msg_conversations))}
                  </td>
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
