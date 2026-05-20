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
  const totalAlertasMeta = clientes.filter((c) => c.receberAlertaSaldo).length;
  const totalAlertasGoogle = clientes.filter((c) => c.receberAlertaGoogle).length;

  const totalCriticoMeta = clientes.filter((c) => {
    if (c.ultimoTipoConta !== "pre_paga" || c.ultimoSaldo === null) return false;
    return Number(c.ultimoSaldo) < Number(c.limiteMinimo);
  }).length;

  const totalCriticoGoogle = clientes.filter((c) => {
    if (c.ultimoTipoContaGoogle !== "pre_paga" || c.ultimoSaldoGoogle === null)
      return false;
    return Number(c.ultimoSaldoGoogle) < Number(c.limiteMinimoGoogle);
  }).length;

  const ultimaSyncMeta = clientes.reduce<Date | null>((acc, c) => {
    if (!c.saldoAtualizadoEm) return acc;
    if (!acc || c.saldoAtualizadoEm > acc) return c.saldoAtualizadoEm;
    return acc;
  }, null);

  const ultimaSyncGoogle = clientes.reduce<Date | null>((acc, c) => {
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
            Saldos Meta Ads e Google Ads dos clientes ativos. Sync automática a cada 1h (08-19h seg-sex).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right text-xs text-neutral-400">
            {ultimaSyncMeta && (
              <p>Meta: última sync {tempoRelativo(ultimaSyncMeta)}</p>
            )}
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
        <Card label="Clientes ativos" value={String(totalAtivos)} />
        <Card label="Alertas Meta" value={String(totalAlertasMeta)} />
        <Card label="Alertas Google" value={String(totalAlertasGoogle)} />
        <Card
          label="Saldos críticos"
          value={String(totalCriticoMeta + totalCriticoGoogle)}
          tone={totalCriticoMeta + totalCriticoGoogle > 0 ? "warn" : "ok"}
        />
      </section>

      {/* Tabela Meta Ads */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-700">
          <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
          Meta Ads
        </h2>
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Conta</th>
                <th className="px-4 py-3 text-right">Saldo</th>
                <th className="px-4 py-3 text-right">Limite</th>
                <th className="px-4 py-3">Alerta</th>
                <th className="px-4 py-3" />
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
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-neutral-500">
                    Nenhum cliente cadastrado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Tabela Google Ads */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-700">
          <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
          Google Ads
        </h2>
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Customer ID</th>
                <th className="px-4 py-3 text-right">Saldo</th>
                <th className="px-4 py-3 text-right">Limite</th>
                <th className="px-4 py-3">Alerta</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {clientes
                .filter((c) => c.googleAdCustomerId)
                .map((c) => {
                  const limite = Number(c.limiteMinimoGoogle);
                  const saldoNum =
                    c.ultimoSaldoGoogle === null ? null : Number(c.ultimoSaldoGoogle);
                  const ehPrePaga = c.ultimoTipoContaGoogle === "pre_paga";
                  const ehPosPaga = c.ultimoTipoContaGoogle === "pos_paga";
                  const baixo =
                    ehPrePaga && saldoNum !== null && saldoNum < limite;

                  return (
                    <tr key={c.id} className="hover:bg-neutral-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-neutral-900">{c.nome}</p>
                        <p className="text-xs text-neutral-500">{c.empresa}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-neutral-500">
                          {c.googleAdCustomerId}
                        </p>
                        {c.ultimoErroGoogle && (
                          <p className="text-xs text-red-600">⚠ {c.ultimoErroGoogle}</p>
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
                            <p className="text-[10px] font-normal text-neutral-400">
                              Pré-paga
                            </p>
                          </>
                        ) : (
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-neutral-400">—</span>
                            {ehPosPaga && (
                              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium uppercase text-amber-700">
                                Pós-paga
                              </span>
                            )}
                            {c.ultimoTipoContaGoogle === "indefinido" && (
                              <span className="text-[10px] text-neutral-400">
                                indefinido
                              </span>
                            )}
                            {!c.ultimoTipoContaGoogle && (
                              <span className="text-[10px] text-neutral-400">
                                aguardando sync
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-neutral-600">
                        {formatBRL(limite, c.moeda)}
                      </td>
                      <td className="px-4 py-3">
                        {c.receberAlertaGoogle ? (
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
              {clientes.filter((c) => c.googleAdCustomerId).length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm text-neutral-500"
                  >
                    Nenhum cliente com Google Ads configurado ainda.{" "}
                    <Link href="/clientes" className="underline">
                      Edite um cliente
                    </Link>{" "}
                    e adicione o Customer ID.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="text-xs text-neutral-400">
        Dados lidos do cache no Postgres. Sync Meta: workflow [SYNC] no n8n (1h).
        Sync Google: workflow [SYNC-GOOGLE] no n8n (1h). Alertas WhatsApp a cada 2h (08-17h seg-sex).
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
