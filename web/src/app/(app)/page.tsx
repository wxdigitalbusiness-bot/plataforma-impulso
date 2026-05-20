import Link from "next/link";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { sincronizarSaldosTodos } from "@/lib/sync-saldos";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatBRL(valor: number | null, moeda = "BRL") {
  if (valor === null) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: moeda,
  }).format(valor);
}

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
  const clientes = await db.clienteAtivo.findMany({
    where: { ativo: true },
    orderBy: [{ receberAlertaSaldo: "desc" }, { nome: "asc" }],
  });

  const totalAtivos = clientes.length;
  const totalAlertas = clientes.filter((c) => c.receberAlertaSaldo).length;
  const totalCritico = clientes.filter((c) => {
    if (c.ultimoTipoConta !== "pre_paga" || c.ultimoSaldo === null) return false;
    return Number(c.ultimoSaldo) < Number(c.limiteMinimo);
  }).length;

  const ultimaSync = clientes.reduce<Date | null>((acc, c) => {
    if (!c.saldoAtualizadoEm) return acc;
    if (!acc || c.saldoAtualizadoEm > acc) return c.saldoAtualizadoEm;
    return acc;
  }, null);

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-neutral-500">
            Saldo Meta Ads dos clientes ativos. Sync automatica a cada 1h (08-19h seg-sex).
          </p>
        </div>
        <div className="flex items-center gap-3">
          {ultimaSync && (
            <span className="text-xs text-neutral-500">
              última sync {tempoRelativo(ultimaSync)}
            </span>
          )}
          <form action={atualizarSaldosAgora}>
            <button
              type="submit"
              className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              title="Forçar sync agora (consulta Meta API para todos os clientes)"
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

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card label="Clientes ativos" value={String(totalAtivos)} />
        <Card label="Recebendo alerta" value={String(totalAlertas)} />
        <Card
          label="Saldo abaixo do limite"
          value={String(totalCritico)}
          tone={totalCritico > 0 ? "warn" : "ok"}
        />
      </section>

      <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Conta Meta</th>
              <th className="px-4 py-3 text-right">Saldo</th>
              <th className="px-4 py-3 text-right">Limite</th>
              <th className="px-4 py-3">Alerta</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {clientes.map((c) => {
              const limite = Number(c.limiteMinimo);
              const saldoNum = c.ultimoSaldo === null ? null : Number(c.ultimoSaldo);
              const ehPrePaga = c.ultimoTipoConta === "pre_paga";
              const ehPosPaga = c.ultimoTipoConta === "pos_paga";
              const baixo = ehPrePaga && saldoNum !== null && saldoNum < limite;

              return (
                <tr key={c.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-neutral-900">{c.nome}</p>
                    <p className="text-xs text-neutral-500">{c.empresa}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-neutral-500">{c.metaAdAccountId}</p>
                    {c.ultimoErro && (
                      <p className="text-xs text-red-600">⚠ {c.ultimoErro}</p>
                    )}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-medium ${
                      baixo ? "text-red-600" : "text-neutral-900"
                    }`}
                  >
                    {ehPrePaga && saldoNum !== null ? (
                      <>
                        {formatBRL(saldoNum, c.moeda)}
                        <p className="text-[10px] font-normal text-neutral-400">Pré-paga</p>
                      </>
                    ) : (
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="text-neutral-400">—</span>
                        {ehPosPaga && (
                          <div className="flex items-center gap-1.5">
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium uppercase text-amber-700">
                              Pós-paga
                            </span>
                            {c.ultimoMetodoPagamento && (
                              <span className="text-[10px] text-neutral-400">
                                {c.ultimoMetodoPagamento}
                              </span>
                            )}
                          </div>
                        )}
                        {c.ultimoTipoConta === "indefinido" && (
                          <span className="text-[10px] text-neutral-400">indefinido</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-600">
                    {formatBRL(limite, c.moeda)}
                  </td>
                  <td className="px-4 py-3">
                    {c.receberAlertaSaldo ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        ativado
                      </span>
                    ) : (
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                        desligado
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/clientes/${c.id}/editar`}
                      className="text-xs font-medium text-neutral-700 hover:underline"
                    >
                      editar
                    </Link>
                  </td>
                </tr>
              );
            })}
            {clientes.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-12 text-center text-sm text-neutral-500"
                >
                  Nenhum cliente cadastrado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <footer className="text-xs text-neutral-400">
        Dados lidos do cache no Postgres (atualizado pelo workflow [SYNC] no n8n). Botão
        &quot;Atualizar agora&quot; força nova consulta na Meta API. Alertas WhatsApp
        rodam a cada 2h (08-17h seg-sex) lendo este mesmo cache.
      </footer>
    </div>
  );
}

function Card({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "ok" | "warn";
}) {
  const toneClass =
    tone === "warn"
      ? "text-red-600"
      : tone === "ok"
        ? "text-emerald-700"
        : "text-neutral-900";
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}
