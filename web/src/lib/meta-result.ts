// Helper client-safe (sem Prisma) para derivar resultado principal + secundários
// a partir das métricas conv_* e do objective da campanha Meta Ads.
// Espelha a lógica de db-insights.ts mas pode ser importado por client components.
//
// IMPORTANTE: page_engagement (conv_profile_visits) NÃO é usado mais como métrica
// independente — ele agrega likes/saves/reactions e não corresponde ao que Ads
// Manager chama de "Visitas ao perfil". Pra LINK_CLICKS direcionado ao perfil IG,
// usamos link_click com label inteligente por nome da campanha.

type MetricaConv = "purchase" | "msg" | "link";

const LABEL_METRICA: Record<MetricaConv, string> = {
  purchase: "Compras",
  msg:      "Conversas iniciadas",
  link:     "Cliques no link",
};

function nomeIndicaTrafegoParaPerfil(nome: string): boolean {
  const n = (nome ?? "").toLowerCase();
  return n.includes("perfil") || n.includes("profile") || /\binstagram\b|\big\b/.test(n);
}

function metricaPorObjective(
  objective: string | null,
  convPurch: number,
  convMsg: number,
  convLink: number,
): MetricaConv | null {
  const obj = (objective ?? "").toUpperCase();

  if (obj === "OUTCOME_SALES" || obj === "CONVERSIONS" || obj === "PRODUCT_CATALOG_SALES") return "purchase";
  if (obj === "OUTCOME_MESSAGES" || obj === "MESSAGES") return "msg";
  if (
    obj === "OUTCOME_TRAFFIC" || obj === "LINK_CLICKS" || obj === "WEBSITE_CLICKS" ||
    obj === "OUTCOME_ENGAGEMENT" || obj === "POST_ENGAGEMENT" || obj === "PAGE_LIKES" || obj === "EVENT_RESPONSES"
  ) return "link";

  if (convPurch > 0) return "purchase";
  if (convMsg   > 0) return "msg";
  if (convLink  > 0) return "link";
  return null;
}

function labelFinal(m: MetricaConv, objective: string | null, campanhaNome: string): string {
  const obj = (objective ?? "").toUpperCase();
  const ehTrafego = obj === "OUTCOME_TRAFFIC" || obj === "LINK_CLICKS" || obj === "WEBSITE_CLICKS";
  if (m === "link" && ehTrafego && nomeIndicaTrafegoParaPerfil(campanhaNome)) {
    return "Visitas ao perfil";
  }
  return LABEL_METRICA[m];
}

/**
 * Retorna métricas secundárias (com valor > 0 e diferentes da principal).
 * Não inclui page_engagement (conv_profile_visits) pois é métrica enganosa.
 */
export function calcularSecundarios(
  objective: string | null,
  campanhaNome: string,
  convPurch: number,
  convMsg: number,
  convLink: number,
): Array<{ tipoResultado: string; conversoes: number }> {
  const principal = metricaPorObjective(objective, convPurch, convMsg, convLink);
  const todas: Array<[MetricaConv, number]> = [
    ["purchase", convPurch],
    ["msg",      convMsg],
    ["link",     convLink],
  ];
  const out: Array<{ tipoResultado: string; conversoes: number }> = [];
  for (const [k, v] of todas) {
    if (v > 0 && k !== principal) {
      out.push({ tipoResultado: labelFinal(k, objective, campanhaNome), conversoes: v });
    }
  }
  return out;
}
