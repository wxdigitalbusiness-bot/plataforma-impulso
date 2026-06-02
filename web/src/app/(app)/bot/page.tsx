import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Metricas7d = {
  total_conversas: bigint | number;
  fechadas: bigint | number;
  perdidas: bigint | number;
  em_aberto: bigint | number;
  taxa_fechamento: number | null;
};

function toNum(v: bigint | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === "bigint" ? Number(v) : v;
}

function formatPct(taxa: number | null | undefined): string {
  if (taxa === null || taxa === undefined) return "—";
  return `${(taxa * 100).toFixed(1)}%`;
}

function formatDateBR(d: Date): string {
  return d.toLocaleDateString("pt-BR");
}

export default async function BotDashboardPage() {
  // Métricas dos últimos 7 dias via view
  const metricas7d = await db.$queryRaw<Metricas7d[]>`
    SELECT total_conversas, fechadas, perdidas, em_aberto, taxa_fechamento
    FROM bot_metricas_7dias;
  `;
  const m = metricas7d[0] ?? { total_conversas: 0, fechadas: 0, perdidas: 0, em_aberto: 0, taxa_fechamento: null };

  // Análises pendentes de aprovação
  const analisesPendentes = await db.botAnaliseSemanal.findMany({
    where: { status: "pendente" },
    orderBy: { criadoEm: "desc" },
    take: 5,
  });

  // Experimentos rodando
  const experimentosRodando = await db.botExperimentoAb.count({
    where: { status: "rodando" },
  });

  // Handoffs ativos
  const handoffsAtivos = await db.conversaHandoff.count({
    where: { handoffActive: true },
  });

  // Fechamentos aguardando confirmação de venda
  const fechamentosPendentes = await db.botConversa.count({
    where: { resultado: "pendente_confirmacao" },
  });

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Bot Marketing Impulso</h1>
        <p className="text-sm text-neutral-500">
          Atendimento e vendas automatizado no WhatsApp + analista de calibração.
        </p>
      </header>

      {/* KPIs últimos 7 dias */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-neutral-700">
          Últimos 7 dias
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <KpiCard label="Conversas" value={String(toNum(m.total_conversas))} />
          <KpiCard label="Fechadas" value={String(toNum(m.fechadas))} tone="ok" />
          <KpiCard label="Em aberto" value={String(toNum(m.em_aberto))} />
          <KpiCard label="Perdidas" value={String(toNum(m.perdidas))} />
          <KpiCard
            label="Taxa de fechamento"
            value={formatPct(m.taxa_fechamento ? Number(m.taxa_fechamento) : null)}
            tone={m.taxa_fechamento && Number(m.taxa_fechamento) > 0.1 ? "ok" : "default"}
          />
        </div>
      </section>

      {/* Cards de navegação */}
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <NavCard
          href="/bot/fechamentos"
          title="Fechamentos a confirmar"
          desc="Leads que disseram SIM — confirme se virou venda."
          badge={fechamentosPendentes > 0 ? `${fechamentosPendentes} aguardando` : undefined}
          badgeTone={fechamentosPendentes > 0 ? "warn" : undefined}
        />
        <NavCard
          href="/bot/analises"
          title="Análises semanais"
          desc="Relatórios do analista IA + sugestões de melhoria do prompt."
          badge={analisesPendentes.length > 0 ? `${analisesPendentes.length} pendente(s)` : undefined}
          badgeTone={analisesPendentes.length > 0 ? "warn" : undefined}
        />
        <NavCard
          href="/bot/experimentos"
          title="Experimentos A/B"
          desc="Testes de variações de prompt rodando em produção."
          badge={experimentosRodando > 0 ? `${experimentosRodando} rodando` : undefined}
          badgeTone={experimentosRodando > 0 ? "ok" : undefined}
        />
        <NavCard
          href="/bot/handoffs"
          title="Handoffs ativos"
          desc="Conversas travadas aguardando atendimento humano."
          badge={handoffsAtivos > 0 ? `${handoffsAtivos}` : undefined}
          badgeTone={handoffsAtivos > 0 ? "warn" : undefined}
        />
      </section>

      {/* Análises pendentes */}
      {analisesPendentes.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-neutral-700">
            Análises aguardando sua revisão
          </h2>
          <div className="rounded-xl border border-neutral-200 bg-white">
            <ul className="divide-y divide-neutral-100">
              {analisesPendentes.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/bot/analises/${a.id}`}
                    className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-neutral-50"
                  >
                    <div>
                      <p className="text-sm font-medium text-neutral-900">
                        Semana {formatDateBR(a.periodoInicio)} a {formatDateBR(a.periodoFim)}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {a.totalConversas} conversas · {a.fechadas} fechadas · taxa{" "}
                        {a.taxaFechamento ? formatPct(Number(a.taxaFechamento)) : "—"}
                      </p>
                    </div>
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium uppercase text-amber-700">
                      Pendente
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <footer className="text-xs text-neutral-400">
        Bot v3 rodando no n8n · Analista semanal cron seg 09h BRT · Métricas a partir de{" "}
        <code className="rounded bg-neutral-100 px-1 py-0.5">bot_metricas_7dias</code>
      </footer>
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "ok" | "warn";
}) {
  const toneClass =
    tone === "ok" ? "text-emerald-700" : tone === "warn" ? "text-red-600" : "text-neutral-900";
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function NavCard({
  href,
  title,
  desc,
  badge,
  badgeTone,
}: {
  href: string;
  title: string;
  desc: string;
  badge?: string;
  badgeTone?: "ok" | "warn";
}) {
  const badgeClass =
    badgeTone === "warn"
      ? "bg-amber-50 text-amber-700"
      : badgeTone === "ok"
        ? "bg-emerald-50 text-emerald-700"
        : "bg-neutral-100 text-neutral-600";
  return (
    <Link
      href={href}
      className="block rounded-xl border border-neutral-200 bg-white p-5 transition hover:border-neutral-300"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-neutral-900">{title}</p>
        {badge && (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${badgeClass}`}>
            {badge}
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-neutral-500">{desc}</p>
    </Link>
  );
}
