// Sincroniza métricas de campanhas Google Ads direto na tabela google_ads_insights.
// Substitui o workflow n8n [SYNC-GOOGLE-MÉTRICAS] — sem dependência externa.

import { db } from "@/lib/db";
import { buscarMetricasCampanhas } from "@/lib/google-ads-api";

export type MetricasSyncResult = {
  total: number;
  sucesso: number;
  falhou: number;
  linhasInseridas: number;
  duracaoMs: number;
  erros: { cliente: string; erro: string }[];
};

export async function sincronizarMetricasGoogle(
  from: string,
  to: string,
): Promise<MetricasSyncResult> {
  const inicio = Date.now();
  const erros: { cliente: string; erro: string }[] = [];
  let sucesso = 0, falhou = 0, linhasInseridas = 0;

  // Busca todos os clientes com Google Ads Customer ID + client_key
  const contas = await db.clienteAtivo.findMany({
    where: { ativo: true, googleAdCustomerId: { not: null } },
    select: {
      googleAdCustomerId: true,
      googleAdsMccId: true,
      cliente: { select: { n8nClientKey: true, nome: true } },
    },
  });

  // Filtra os que têm client_key (necessário para gravar na tabela)
  const contasValidas = contas.filter((c) => c.cliente?.n8nClientKey);

  for (const conta of contasValidas) {
    const customerId = conta.googleAdCustomerId!;
    const clientKey  = conta.cliente!.n8nClientKey!;
    const nome       = conta.cliente!.nome ?? clientKey;

    try {
      const metricas = await buscarMetricasCampanhas(
        customerId,
        from,
        to,
        conta.googleAdsMccId,
      );

      if (metricas.length === 0) { sucesso++; continue; }

      // Remove dados antigos do período para evitar duplicatas
      await db.$executeRaw`
        DELETE FROM google_ads_insights
        WHERE customer_id = ${customerId}
          AND date::date BETWEEN ${from}::date AND ${to}::date
      `;

      // Insere linha por linha (n8n fazia o mesmo)
      for (const m of metricas) {
        const costPerConv = m.conversions > 0
          ? Math.round((m.spend / m.conversions) * 100) / 100
          : null;

        await db.$executeRaw`
          INSERT INTO google_ads_insights
            (client_key, date, customer_id, campaign_id, campaign_name, campaign_type,
             spend, impressions, clicks, conversions, cost_per_conv, created_at)
          VALUES
            (${clientKey}, ${m.date}::date, ${customerId}, ${m.campaignId},
             ${m.campaignName}, ${m.campaignType},
             ${m.spend}, ${m.impressions}, ${m.clicks}, ${m.conversions},
             ${costPerConv}, NOW())
        `;
        linhasInseridas++;
      }

      sucesso++;
    } catch (err) {
      falhou++;
      erros.push({ cliente: nome, erro: String(err) });
      console.error(`[SYNC-GOOGLE-MÉTRICAS] ${nome}:`, err);
    }
  }

  return {
    total: contasValidas.length,
    sucesso,
    falhou,
    linhasInseridas,
    duracaoMs: Date.now() - inicio,
    erros,
  };
}
