import Link from "next/link";
import { db } from "@/lib/db";
import { tipoServicoLabel } from "./_servicos";

export const dynamic = "force-dynamic";

function formatBRL(valor: number, moeda = "BRL") {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: moeda,
  }).format(valor);
}

export default async function ClientesPage() {
  const clientes = await db.cliente.findMany({
    include: {
      contas: {
        select: {
          id: true,
          ativo: true,
          metaAdAccountId: true,
          googleAdCustomerId: true,
          ultimoSaldo: true,
          ultimoTipoConta: true,
          limiteMinimo: true,
          ultimoSaldoGoogle: true,
          ultimoTipoContaGoogle: true,
          limiteMinimoGoogle: true,
          moeda: true,
        },
      },
    },
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
  });

  // Conta órfã = ClienteAtivo sem clienteId (não vinculado a nenhum parent)
  const orfas = await db.clienteAtivo.findMany({
    where: { clienteId: null },
    select: { id: true, nome: true, empresa: true },
  });

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-sm text-neutral-500">
            {clientes.length}{" "}
            {clientes.length === 1 ? "cliente cadastrado" : "clientes cadastrados"}
            {" · "}
            {clientes.reduce((acc, c) => acc + c.contas.length, 0)} contas no total
          </p>
        </div>
        <Link
          href="/clientes/novo"
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          + Novo cliente
        </Link>
      </header>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Serviço</th>
              <th className="px-4 py-3 text-center">Contas</th>
              <th className="px-4 py-3">Plataformas</th>
              <th className="px-4 py-3">Saldos críticos</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {clientes.map((c) => {
              const totalContas = c.contas.length;
              const contasAtivas = c.contas.filter((co) => co.ativo).length;
              const temMeta = c.contas.some((co) => co.metaAdAccountId);
              const temGoogle = c.contas.some((co) => co.googleAdCustomerId);

              const criticos = c.contas.filter((co) => {
                const metaBaixo =
                  co.ultimoTipoConta === "pre_paga" &&
                  co.ultimoSaldo !== null &&
                  Number(co.ultimoSaldo) < Number(co.limiteMinimo);
                const googleBaixo =
                  co.ultimoTipoContaGoogle === "pre_paga" &&
                  co.ultimoSaldoGoogle !== null &&
                  Number(co.ultimoSaldoGoogle) < Number(co.limiteMinimoGoogle);
                return metaBaixo || googleBaixo;
              }).length;

              return (
                <tr key={c.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/clientes/${c.id}`}
                      className="font-medium text-neutral-900 hover:underline"
                    >
                      {c.nome}
                    </Link>
                    {c.empresa && (
                      <p className="text-xs text-neutral-500">{c.empresa}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {c.tipoServico ? (
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-700">
                        {tipoServicoLabel(c.tipoServico)}
                      </span>
                    ) : (
                      <span className="text-neutral-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-neutral-600">
                    {contasAtivas}
                    {totalContas !== contasAtivas && (
                      <span className="text-xs text-neutral-400">
                        {" "}
                        / {totalContas}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {temMeta && (
                        <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                          Meta
                        </span>
                      )}
                      {temGoogle && (
                        <span className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                          Google
                        </span>
                      )}
                      {!temMeta && !temGoogle && (
                        <span className="text-xs text-neutral-400">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {criticos > 0 ? (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                        {criticos} crítico{criticos > 1 ? "s" : ""}
                      </span>
                    ) : (
                      <span className="text-xs text-neutral-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {c.ativo ? (
                      <span className="text-xs text-emerald-700">ativo</span>
                    ) : (
                      <span className="text-xs text-neutral-400">inativo</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/clientes/${c.id}`}
                      className="text-xs font-medium text-neutral-700 hover:underline"
                    >
                      abrir →
                    </Link>
                  </td>
                </tr>
              );
            })}
            {clientes.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-12 text-center text-sm text-neutral-500"
                >
                  Nenhum cliente cadastrado.{" "}
                  <Link
                    href="/clientes/novo"
                    className="font-medium text-neutral-900 underline"
                  >
                    Criar primeiro cliente
                  </Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {orfas.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
          <p className="text-sm font-medium text-amber-900">
            ⚠ {orfas.length} {orfas.length === 1 ? "conta sem cliente" : "contas sem cliente"} vinculado
          </p>
          <p className="mt-1 text-xs text-amber-800">
            Estas contas existem mas não estão agrupadas a nenhum cliente. Crie um
            cliente e vincule-as manualmente editando cada uma.
          </p>
          <ul className="mt-3 space-y-1 text-xs text-amber-900">
            {orfas.map((o) => (
              <li key={o.id}>
                · {o.nome} <span className="text-amber-700">({o.empresa})</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
