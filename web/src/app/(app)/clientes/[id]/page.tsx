import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { tipoServicoLabel } from "../_servicos";

export const dynamic = "force-dynamic";

function formatBRL(valor: number | null, moeda = "BRL") {
  if (valor === null) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: moeda,
  }).format(valor);
}

type Props = { params: Promise<{ id: string }> };

export default async function ClienteDetalhePage({ params }: Props) {
  const { id } = await params;
  const clienteId = Number(id);
  if (Number.isNaN(clienteId)) notFound();

  const cliente = await db.cliente.findUnique({
    where: { id: clienteId },
    include: {
      contas: {
        orderBy: [{ ativo: "desc" }, { nome: "asc" }],
      },
    },
  });
  if (!cliente) notFound();

  const contasMeta = cliente.contas.filter((c) => c.metaAdAccountId);
  const contasGoogle = cliente.contas.filter((c) => c.googleAdCustomerId);

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between">
        <div>
          <Link
            href="/clientes"
            className="text-xs text-neutral-500 hover:underline"
          >
            ← Clientes
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {cliente.nome}
          </h1>
          <p className="text-sm text-neutral-500">
            {cliente.contas.length}{" "}
            {cliente.contas.length === 1 ? "conta vinculada" : "contas vinculadas"}
            {!cliente.ativo && (
              <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                inativo
              </span>
            )}
          </p>
          <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-neutral-600">
            {cliente.empresa && (
              <div>
                <dt className="inline text-neutral-400">Empresa: </dt>
                <dd className="inline">{cliente.empresa}</dd>
              </div>
            )}
            {cliente.tipoServico && (
              <div>
                <dt className="inline text-neutral-400">Serviço: </dt>
                <dd className="inline">{tipoServicoLabel(cliente.tipoServico)}</dd>
              </div>
            )}
            {cliente.whatsappAlerta && (
              <div>
                <dt className="inline text-neutral-400">WhatsApp alertas: </dt>
                <dd className="inline">{cliente.whatsappAlerta}</dd>
              </div>
            )}
            {!cliente.empresa && !cliente.whatsappAlerta && !cliente.tipoServico && (
              <div className="text-neutral-400">
                <Link
                  href={`/clientes/${cliente.id}/editar`}
                  className="underline"
                >
                  Adicionar empresa, tipo de serviço e WhatsApp
                </Link>
              </div>
            )}
          </dl>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/clientes/${cliente.id}/editar`}
            className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Editar cliente
          </Link>
          <Link
            href={`/clientes/${cliente.id}/crm`}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
          >
            CRM
          </Link>
          {cliente.tipoServico === "panfletagem_digital" ? (
            <Link
              href={`/clientes/${cliente.id}/panfletagem`}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
            >
              Ver Panfletagem
            </Link>
          ) : (
            <Link
              href={`/clientes/${cliente.id}/performance`}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
            >
              Ver Performance
            </Link>
          )}
          <Link
            href={`/clientes/${cliente.id}/contas/novo`}
            className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            + Nova conta
          </Link>
        </div>
      </header>

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
                <th className="px-4 py-3">Conta</th>
                <th className="px-4 py-3">Ad Account ID</th>
                <th className="px-4 py-3 text-right">Saldo</th>
                <th className="px-4 py-3 text-right">Limite</th>
                <th className="px-4 py-3">Alerta</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {contasMeta.map((c) => {
                const limite = Number(c.limiteMinimo);
                const saldoNum =
                  c.ultimoSaldo === null ? null : Number(c.ultimoSaldo);
                const ehPrePaga = c.ultimoTipoConta === "pre_paga";
                const ehPosPaga = c.ultimoTipoConta === "pos_paga";
                const baixo =
                  ehPrePaga && saldoNum !== null && saldoNum < limite;

                return (
                  <tr key={c.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-neutral-900">{c.nome}</p>
                      {!c.ativo && (
                        <p className="text-[10px] text-neutral-400">inativa</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-neutral-500">
                        {c.metaAdAccountId}
                      </p>
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
                          <p className="text-[10px] font-normal text-neutral-400">
                            Pré-paga
                          </p>
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
                        href={`/clientes/${cliente.id}/contas/${c.id}/editar`}
                        className="text-xs font-medium text-neutral-700 hover:underline"
                      >
                        editar
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {contasMeta.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm text-neutral-500"
                  >
                    Nenhuma conta Meta Ads vinculada.{" "}
                    <Link
                      href={`/clientes/${cliente.id}/contas/novo`}
                      className="font-medium text-neutral-700 underline"
                    >
                      Adicionar conta
                    </Link>
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
                <th className="px-4 py-3">Conta</th>
                <th className="px-4 py-3">Customer ID</th>
                <th className="px-4 py-3 text-right">Saldo</th>
                <th className="px-4 py-3 text-right">Limite</th>
                <th className="px-4 py-3">Alerta</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {contasGoogle.map((c) => {
                const limite = Number(c.limiteMinimoGoogle);
                const saldoNum =
                  c.ultimoSaldoGoogle === null
                    ? null
                    : Number(c.ultimoSaldoGoogle);
                const ehPrePaga = c.ultimoTipoContaGoogle === "pre_paga";
                const ehPosPaga = c.ultimoTipoContaGoogle === "pos_paga";
                const baixo =
                  ehPrePaga && saldoNum !== null && saldoNum < limite;

                return (
                  <tr key={c.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-neutral-900">{c.nome}</p>
                      {!c.ativo && (
                        <p className="text-[10px] text-neutral-400">inativa</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-neutral-500">
                        {c.googleAdCustomerId}
                      </p>
                      {c.ultimoErroGoogle && (
                        <p className="text-xs text-red-600">
                          ⚠ {c.ultimoErroGoogle}
                        </p>
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
                        href={`/clientes/${cliente.id}/contas/${c.id}/editar`}
                        className="text-xs font-medium text-neutral-700 hover:underline"
                      >
                        editar
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {contasGoogle.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm text-neutral-500"
                  >
                    Nenhuma conta Google Ads vinculada.{" "}
                    <Link
                      href={`/clientes/${cliente.id}/contas/novo`}
                      className="font-medium text-neutral-700 underline"
                    >
                      Adicionar conta
                    </Link>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
