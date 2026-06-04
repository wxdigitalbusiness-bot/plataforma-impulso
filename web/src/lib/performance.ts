// Agrega métricas de Performance (CPC/CTR/conversões) de Meta + Google Ads
// por Cliente. Consulta diretamente as tabelas populadas pelos workflows n8n
// (fb_meta_insights, google_ads_insights) — sem chamadas de API ao vivo.
//
// Resultado: carregamento <200ms vs ~3-5s com APIs, sem rate limit.
// Dados atualizados diariamente pelos workflows [SYNC-META-MÉTRICAS] e
// [SYNC-GOOGLE-MÉTRICAS] que rodam a partir de 01h BRT.
//
// Cache em memória com TTL 10 min.

import { db } from "@/lib/db";
import {
  getMetaInsightsDBMultiplos,
  getGoogleInsightsDBMultiplos,
  emptyMetaInsightsDB,
  emptyGoogleInsightsDB,
  type MetaInsightsDB,
  type GoogleInsightsDB,
} from "@/lib/db-insights";

export type PerformanceMetricas = {
  spend: number;
  impressoes: number;
  cliques: number;
  ctr: number;
  cpc: number;
  conversoes: number;
  taxaConversao: number;
  reach: number;
  frequencia: number;
  tipoResultado: string;
  erros: string[];
};

export type ClientePerformance = {
  clienteId: number;
  nome: string;
  empresa: string | null;
  tipoServico: string | null;
  contasMeta: number;
  contasGoogle: number;
  meta: PerformanceMetricas;
  google: PerformanceMetricas;
  total: PerformanceMetricas;
};

export type PerformanceAgregada = {
  from: string;
  to: string;
  geradoEm: Date;
  totalSpend: number;
  totalCliques: number;
  totalConversoes: number;
  ctrMedio: number;
  cpcMedio: number;
  porCliente: ClientePerformance[];
};

// ─── Cache ────────────────────────────────────────────────────────────────────

type CacheEntry = { data: PerformanceAgregada; expiresAt: number };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000;

function cacheKey(from: string, to: string) {
  return `performance:${from}:${to}`;
}

export function defaultRange(): { from: string; to: string } {
  // Calcula em BRT (UTC-3) para coincidir com o ciclo do sync (01h BRT).
  // Evita que o servidor UTC passe para o dia seguinte antes da meia-noite BRT,
  // o que faria "to" apontar para hoje (sem dados no banco ainda).
  const brt = new Date(Date.now() - 3 * 60 * 60 * 1000); // desloca para BRT
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  // to = ontem BRT (último dia coberto pelo sync de 01h BRT)
  const to = new Date(brt);
  to.setUTCDate(brt.getUTCDate() - 1);

  // from = 6 dias antes de to → janela de 7 dias (igual ao sync last_7d)
  const from = new Date(to);
  from.setUTCDate(to.getUTCDate() - 6);

  return { from: fmt(from), to: fmt(to) };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function obterPerformance(opts?: {
  from?: string;
  to?: string;
  forcarRefresh?: boolean;
}): Promise<PerformanceAgregada> {
  const range =
    opts?.from && opts?.to ? { from: opts.from, to: opts.to } : defaultRange();
  const key = cacheKey(range.from, range.to);

  if (!opts?.forcarRefresh) {
    const hit = cache.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.data;
  }

  const data = await calcular(range.from, range.to);
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}

export function limparCachePerformance() {
  cache.clear();
}

// ─── Implementação ────────────────────────────────────────────────────────────

async function calcular(from: string, to: string): Promise<PerformanceAgregada> {
  // 1. Clientes ativos com contagem de contas
  const clientes = await db.cliente.findMany({
    where: {
      ativo: true,
      tipoServico: { in: ["gestao_trafego", "impulso_360"] },
    },
    include: {
      contas: {
        where: { ativo: true },
        select: { metaAdAccountId: true, googleAdCustomerId: true },
      },
    },
    orderBy: { nome: "asc" },
  });

  if (clientes.length === 0) {
    return {
      from, to, geradoEm: new Date(),
      totalSpend: 0, totalCliques: 0, totalConversoes: 0,
      ctrMedio: 0, cpcMedio: 0, porCliente: [],
    };
  }

  // 2. Busca n8n_client_key de todos os clientes via SQL direto
  const ids = clientes.map((c) => c.id);
  type KeyRow = { id: number; n8n_client_key: string | null };
  const keyRows = await db.$queryRaw<KeyRow[]>`
    SELECT id, n8n_client_key FROM clientes WHERE id = ANY(${ids})
  `;

  const keyMap = new Map<number, string>(
    keyRows
      .filter((r): r is { id: number; n8n_client_key: string } =>
        r.n8n_client_key !== null && r.n8n_client_key.trim() !== "",
      )
      .map((r) => [r.id, r.n8n_client_key.toLowerCase()]),
  );

  const allKeys = [...new Set(keyMap.values())];

  // 3. Duas queries batch no banco (uma por plataforma)
  const [metaMap, googleMap] = await Promise.all([
    getMetaInsightsDBMultiplos(allKeys, from, to),
    getGoogleInsightsDBMultiplos(allKeys, from, to),
  ]);

  // 4. Monta resultado por cliente
  const porCliente: ClientePerformance[] = clientes
    .map((c) => {
      const key    = keyMap.get(c.id) ?? null;
      const meta   = key ? (metaMap.get(key)   ?? emptyMetaInsightsDB())   : emptyMetaInsightsDB();
      const google = key ? (googleMap.get(key) ?? emptyGoogleInsightsDB()) : emptyGoogleInsightsDB();

      const metaM   = metaDBToMetricas(meta);
      const googleM = googleDBToMetricas(google);
      const total   = calcularTotal(metaM, googleM);

      return {
        clienteId:    c.id,
        nome:         c.nome,
        empresa:      c.empresa,
        tipoServico:  c.tipoServico,
        contasMeta:   c.contas.filter((co) => co.metaAdAccountId).length,
        contasGoogle: c.contas.filter((co) => co.googleAdCustomerId).length,
        meta:   metaM,
        google: googleM,
        total,
      };
    })
    .sort((a, b) => b.total.spend - a.total.spend);

  // 5. Totalizadores
  let totalSpend = 0, totalCliques = 0, totalConversoes = 0, totalImpressoes = 0;
  for (const c of porCliente) {
    totalSpend      += c.total.spend;
    totalCliques    += c.total.cliques;
    totalConversoes += c.total.conversoes;
    totalImpressoes += c.total.impressoes;
  }

  return {
    from, to,
    geradoEm: new Date(),
    totalSpend:      round2(totalSpend),
    totalCliques,
    totalConversoes: round2(totalConversoes),
    ctrMedio:  totalImpressoes > 0 ? round2((totalCliques / totalImpressoes) * 100) : 0,
    cpcMedio:  totalCliques > 0 ? round2(totalSpend / totalCliques) : 0,
    porCliente,
  };
}

// ─── Conversores ──────────────────────────────────────────────────────────────

function metaDBToMetricas(m: MetaInsightsDB): PerformanceMetricas {
  const pm = emptyMetricas();
  pm.spend        = m.spend;
  pm.impressoes   = m.impressoes;
  pm.cliques      = m.cliques;
  pm.conversoes   = m.conversoes;
  pm.reach        = m.reach;
  pm.tipoResultado = m.tipoResultado;
  finalizarMetricas(pm);
  return pm;
}

function googleDBToMetricas(g: GoogleInsightsDB): PerformanceMetricas {
  const pm = emptyMetricas();
  pm.spend      = g.spend;
  pm.impressoes = g.impressoes;
  pm.cliques    = g.cliques;
  pm.conversoes = g.conversoes;
  finalizarMetricas(pm);
  return pm;
}

function calcularTotal(
  meta: PerformanceMetricas,
  google: PerformanceMetricas,
): PerformanceMetricas {
  const t = emptyMetricas();
  t.spend      = meta.spend + google.spend;
  t.impressoes = meta.impressoes + google.impressoes;
  t.cliques    = meta.cliques + google.cliques;
  t.conversoes = meta.conversoes + google.conversoes;
  t.reach      = meta.reach;
  t.erros      = [...meta.erros, ...google.erros];
  finalizarMetricas(t);
  return t;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyMetricas(): PerformanceMetricas {
  return {
    spend: 0, impressoes: 0, cliques: 0, ctr: 0, cpc: 0,
    conversoes: 0, taxaConversao: 0, reach: 0, frequencia: 0,
    tipoResultado: "", erros: [],
  };
}

function finalizarMetricas(m: PerformanceMetricas) {
  m.ctr         = m.impressoes > 0 ? round2((m.cliques / m.impressoes) * 100) : 0;
  m.cpc         = m.cliques > 0 ? round2(m.spend / m.cliques) : 0;
  m.taxaConversao = m.cliques > 0 ? round2((m.conversoes / m.cliques) * 100) : 0;
  m.frequencia  = m.reach > 0 ? round2(m.impressoes / m.reach) : 0;
  m.spend       = round2(m.spend);
  m.conversoes  = round2(m.conversoes);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
