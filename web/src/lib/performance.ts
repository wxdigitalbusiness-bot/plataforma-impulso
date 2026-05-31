// Agrega métricas de Performance (CPC/CTR/conversões) de Meta + Google Ads
// por Cliente (parent). Pega contas ativas, dispara API calls em paralelo
// (com concurrency limit) e soma por cliente.
//
// Cache em memória com TTL 10 min — primeiro acesso após cache miss leva
// ~3-5s; acessos subsequentes são instantâneos.

import { db } from "@/lib/db";
import { getInsightsMeta, type MetaInsightsResultado } from "@/lib/meta-api";
import { getInsightsGoogle, type GoogleInsightsResultado } from "@/lib/google-ads-api";

export type PerformanceMetricas = {
  spend: number;
  impressoes: number;
  cliques: number;
  ctr: number;           // percentage 0..100 (calculado a partir dos totais)
  cpc: number;           // moeda (calculado a partir dos totais)
  conversoes: number;
  taxaConversao: number; // percentage 0..100 (conversoes / cliques * 100)
  reach: number;         // raw acumulador — apenas Meta (para cálculo de frequencia)
  frequencia: number;    // impressoes / reach (Meta only)
  tipoResultado: string; // label PT-BR do resultado dominante (Meta only)
  erros: string[];       // mensagens de contas que falharam
};

export type ClientePerformance = {
  clienteId: number;
  nome: string;
  empresa: string | null;
  tipoServico: string | null;
  contasMeta: number;        // quantas contas Meta esse cliente tem
  contasGoogle: number;      // quantas contas Google
  meta: PerformanceMetricas;
  google: PerformanceMetricas;
  total: PerformanceMetricas;
};

export type PerformanceAgregada = {
  from: string;   // ISO date YYYY-MM-DD
  to: string;     // ISO date YYYY-MM-DD
  geradoEm: Date;
  totalSpend: number;
  totalCliques: number;
  totalConversoes: number;
  ctrMedio: number;
  cpcMedio: number;
  porCliente: ClientePerformance[];
};

// ─── Cache ───────────────────────────────────────────────────────────────────

type CacheEntry = { data: PerformanceAgregada; expiresAt: number };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000;

function cacheKey(from: string, to: string) {
  return `performance:${from}:${to}`;
}

// Retorna o intervalo padrão: últimos 3 dias (anteontem → ontem)
export function defaultRange(): { from: string; to: string } {
  const hoje = new Date();
  const to = new Date(hoje); to.setDate(hoje.getDate() - 1);
  const from = new Date(hoje); from.setDate(hoje.getDate() - 3);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(from), to: fmt(to) };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function obterPerformance(opts?: {
  from?: string;
  to?: string;
  forcarRefresh?: boolean;
}): Promise<PerformanceAgregada> {
  const range = opts?.from && opts?.to
    ? { from: opts.from, to: opts.to }
    : defaultRange();
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

// ─── Implementação ───────────────────────────────────────────────────────────

async function calcular(from: string, to: string): Promise<PerformanceAgregada> {
  // Pega clientes ativos com suas contas
  const clientes = await db.cliente.findMany({
    where: { ativo: true },
    include: {
      contas: {
        where: { ativo: true },
        select: {
          id: true,
          metaAdAccountId: true,
          googleAdCustomerId: true,
          googleAdsMccId: true,
        },
      },
    },
    orderBy: { nome: "asc" },
  });

  // Achatar pra fazer todas as chamadas em paralelo
  type TaskMeta = { type: "meta"; clienteId: number; adAccountId: string };
  type TaskGoogle = { type: "google"; clienteId: number; customerId: string; mccId: string | null };
  const tasks: Array<TaskMeta | TaskGoogle> = [];

  for (const c of clientes) {
    for (const conta of c.contas) {
      if (conta.metaAdAccountId) {
        tasks.push({ type: "meta", clienteId: c.id, adAccountId: conta.metaAdAccountId });
      }
      if (conta.googleAdCustomerId) {
        tasks.push({
          type: "google",
          clienteId: c.id,
          customerId: conta.googleAdCustomerId,
          mccId: conta.googleAdsMccId,
        });
      }
    }
  }

  // Concurrency limit pra não estourar rate limits
  const CONCURRENCY = 8;
  const resultados = await runComConcorrencia(tasks, CONCURRENCY, async (t) => {
    if (t.type === "meta") {
      const r = await getInsightsMeta(t.adAccountId, from, to);
      return { type: "meta" as const, clienteId: t.clienteId, dado: r };
    } else {
      const r = await getInsightsGoogle(t.customerId, t.mccId, from, to);
      return { type: "google" as const, clienteId: t.clienteId, dado: r };
    }
  });

  // Agrega por cliente
  const porClienteMap = new Map<number, ClientePerformance>();

  for (const c of clientes) {
    porClienteMap.set(c.id, {
      clienteId: c.id,
      nome: c.nome,
      empresa: c.empresa,
      tipoServico: c.tipoServico,
      contasMeta: c.contas.filter((co) => co.metaAdAccountId).length,
      contasGoogle: c.contas.filter((co) => co.googleAdCustomerId).length,
      meta: emptyMetricas(),
      google: emptyMetricas(),
      total: emptyMetricas(),
    });
  }

  // Acumula métricas e rastreia tipoResultado por cliente (Meta)
  // { clienteId → Array<{ tipo, conversoes }> } — para escolher o tipo dominante
  const metaTipos = new Map<number, Array<{ tipo: string; conversoes: number }>>();

  for (const r of resultados) {
    const cliente = porClienteMap.get(r.clienteId);
    if (!cliente) continue;
    if (r.type === "meta") {
      acumular(cliente.meta, r.dado);
      if (!r.dado.erro && (r.dado as MetaInsightsResultado).tipoResultado) {
        const lista = metaTipos.get(r.clienteId) ?? [];
        lista.push({
          tipo: (r.dado as MetaInsightsResultado).tipoResultado,
          conversoes: r.dado.conversoes,
        });
        metaTipos.set(r.clienteId, lista);
      }
    } else {
      acumular(cliente.google, r.dado);
    }
  }

  // Recalcular CTR/CPC/freq/taxa dos agregados a partir dos totais
  for (const c of porClienteMap.values()) {
    finalizarMetricas(c.meta);
    finalizarMetricas(c.google);
    // tipoResultado: escolhe o tipo da conta com mais conversões (ou cliques)
    const tipos = metaTipos.get(c.clienteId);
    if (tipos && tipos.length > 0) {
      const best = tipos.reduce((a, b) =>
        b.conversoes > a.conversoes ? b : a,
      );
      c.meta.tipoResultado = best.tipo;
    }
    // Total = Meta + Google
    c.total.spend = c.meta.spend + c.google.spend;
    c.total.impressoes = c.meta.impressoes + c.google.impressoes;
    c.total.cliques = c.meta.cliques + c.google.cliques;
    c.total.conversoes = c.meta.conversoes + c.google.conversoes;
    c.total.erros = [...c.meta.erros, ...c.google.erros];
    finalizarMetricas(c.total);
  }

  const porCliente = Array.from(porClienteMap.values())
    .sort((a, b) => b.total.spend - a.total.spend);

  // Totalizadores da agência
  let totalSpend = 0;
  let totalImpressoes = 0;
  let totalCliques = 0;
  let totalConversoes = 0;
  for (const c of porCliente) {
    totalSpend += c.total.spend;
    totalImpressoes += c.total.impressoes;
    totalCliques += c.total.cliques;
    totalConversoes += c.total.conversoes;
  }
  const ctrMedio = totalImpressoes > 0 ? (totalCliques / totalImpressoes) * 100 : 0;
  const cpcMedio = totalCliques > 0 ? totalSpend / totalCliques : 0;

  return {
    from,
    to,
    geradoEm: new Date(),
    totalSpend: round2(totalSpend),
    totalCliques,
    totalConversoes: round2(totalConversoes),
    ctrMedio: round2(ctrMedio),
    cpcMedio: round2(cpcMedio),
    porCliente,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function emptyMetricas(): PerformanceMetricas {
  return {
    spend: 0,
    impressoes: 0,
    cliques: 0,
    ctr: 0,
    cpc: 0,
    conversoes: 0,
    taxaConversao: 0,
    reach: 0,
    frequencia: 0,
    tipoResultado: "",
    erros: [],
  };
}

function acumular(acc: PerformanceMetricas, dado: MetaInsightsResultado | GoogleInsightsResultado) {
  if (dado.erro) {
    acc.erros.push(dado.erro);
    return;
  }
  acc.spend += dado.spend;
  acc.impressoes += dado.impressoes;
  acc.cliques += dado.cliques;
  acc.conversoes += dado.conversoes;
  // reach/frequencia são exclusivos do Meta
  if ("reach" in dado) {
    acc.reach += (dado as MetaInsightsResultado).reach;
  }
  // ctr/cpc/taxaConversao/frequencia são recalculados em finalizarMetricas
}

function finalizarMetricas(m: PerformanceMetricas) {
  m.ctr = m.impressoes > 0 ? round2((m.cliques / m.impressoes) * 100) : 0;
  m.cpc = m.cliques > 0 ? round2(m.spend / m.cliques) : 0;
  m.taxaConversao = m.cliques > 0 ? round2((m.conversoes / m.cliques) * 100) : 0;
  m.frequencia = m.reach > 0 ? round2(m.impressoes / m.reach) : 0;
  m.spend = round2(m.spend);
  m.conversoes = round2(m.conversoes);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function runComConcorrencia<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const resultados: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      resultados[i] = await fn(items[i]);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return resultados;
}
