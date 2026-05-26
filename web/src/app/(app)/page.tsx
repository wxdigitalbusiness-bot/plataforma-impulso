import Link from "next/link";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { sincronizarSaldosTodos } from "@/lib/sync-saldos";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function tempoRelativo(data: Date | null) {
  if (!data) return null;
  const segundos = Math.round((Date.now() - data.getTime()) / 1000);
  if (segundos < 60) return `há ${segundos}s`;
  const minutos = Math.round(segundos / 60);
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `há ${horas}h`;
  const dias = Math.round(horas / 24);
  return `há ${dias}d`;
}

async function atualizarSaldosAgora() {
  "use server";
  await sincronizarSaldosTodos();
  revalidatePath("/");
}

export default async function DashboardPage() {
  // Contas ativas (linhas individuais de clientes_ativos)
  const contas = await db.clienteAtivo.findMany({
    where: { ativo: true },
    select: {
      ultimoSaldo: true,
      ultimoTipoConta: true,
      limiteMinimo: true,
      receberAlertaSaldo: true,
      saldoAtualizadoEm: true,
      ultimoSaldoGoogle: true,
      ultimoTipoContaGoogle: true,
      limiteMinimoGoogle: true,
      receberAlertaGoogle: true,
      saldoGoogleAtualizadoEm: true,
    },
  });

  // Clientes ativos (entidade parent — count distinct de cliente, não de conta)
  const totalClientesAtivos = await db.cliente.count({
    where: { ativo: true },
  });

  const totalAlertasMeta = contas.filter((c) => c.receberAlertaSaldo).length;
  const totalAlertasGoogle = contas.filter((c) => c.receberAlertaGoogle).length;

  const totalCriticoMeta = contas.filter((c) => {
    if (c.ultimoTipoConta !== "pre_paga" || c.ultimoSaldo === null) return false;
    return Number(c.ultimoSaldo) < Number(c.limiteMinimo);
  }).length;

  const totalCriticoGoogle = contas.filter((c) => {
    if (c.ultimoTipoContaGoogle !== "pre_paga" || c.ultimoSaldoGoogle === null)
      return false;
    return Number(c.ultimoSaldoGoogle) < Number(c.limiteMinimoGoogle);
  }).length;

  const totalCriticos = totalCriticoMeta + totalCriticoGoogle;

  const ultimaSyncMeta = contas.reduce<Date | null>((acc, c) => {
    if (!c.saldoAtualizadoEm) return acc;
    if (!acc || c.saldoAtualizadoEm > acc) return c.saldoAtualizadoEm;
    return acc;
  }, null);

  const ultimaSyncGoogle = contas.reduce<Date | null>((acc, c) => {
    if (!c.saldoGoogleAtualizadoEm) return acc;
    if (!acc || c.saldoGoogleAtualizadoEm > acc) return c.saldoGoogleAtualizadoEm;
    return acc;
  }, null);

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-neutral-500">
            Resumo geral da agência. Sync automática a cada 1h, 08h–17h BRT, seg–sex.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right text-xs text-neutral-400">
            {ultimaSyncMeta && <p>Meta: última sync {tempoRelativo(ultimaSyncMeta)}</p>}
            {ultimaSyncGoogle && (
              <p>Google: última sync {tempoRelativo(ultimaSyncGoogle)}</p>
            )}
          </div>
          <form action={atualizarSaldosAgora}>
            <button
              type="submit"
              className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              title="Forçar sync agora (Meta + Google)"
            >
              ↻ Atualizar agora
            </button>
          </form>
          <Link
            href="/clientes/novo"
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            + Novo cliente
          </Link>
        </div>
      </header>

      {/* Cards de resumo */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card
          label="Clientes ativos"
          value={String(totalClientesAtivos)}
          href="/clientes"
        />
        <Card label="Alertas Meta" value={String(totalAlertasMeta)} />
        <Card label="Alertas Google" value={String(totalAlertasGoogle)} />
        <Card
          label="Saldos críticos"
          value={String(totalCriticos)}
          tone={totalCriticos > 0 ? "warn" : "ok"}
          href={totalCriticos > 0 ? "/clientes" : undefined}
        />
      </section>

      {/* Placeholder pra métricas futuras */}
      <section className="rounded-xl border border-dashed border-neutral-300 bg-white p-12 text-center">
        <p className="text-sm font-medium text-neutral-700">
          Métricas detalhadas em breve
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          Gráficos de spend, performance e tendências serão adicionados aqui.
        </p>
      </section>

      <footer className="text-xs text-neutral-400">
        Sync Meta: workflow [SYNC] no n8n (1h). Sync Google: workflow [SYNC-GOOGLE] no
        n8n (1h, 08-17h BRT). Alertas WhatsApp a cada 2h (08:05–16:05 BRT).
      </footer>
    </div>
  );
}

function Card({
  label,
  value,
  tone = "default",
  href,
}: {
  label: string;
  value: string;
  tone?: "default" | "ok" | "warn";
  href?: string;
}) {
  const toneClass =
    tone === "warn"
      ? "text-red-600"
      : tone === "ok"
        ? "text-emerald-700"
        : "text-neutral-900";

  const inner = (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 transition hover:border-neutral-300">
      <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {inner}
      </Link>
    );
  }
  return inner;
}
