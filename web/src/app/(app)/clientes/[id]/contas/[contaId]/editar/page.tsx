import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ContaForm, type ContaFormData } from "../../../../_conta-form";
import { atualizarConta, excluirConta } from "../../../../_conta-actions";

type Props = { params: Promise<{ id: string; contaId: string }> };

export default async function EditarContaPage({ params }: Props) {
  const { id, contaId } = await params;
  const clienteId = Number(id);
  const contaIdNum = Number(contaId);
  if (Number.isNaN(clienteId) || Number.isNaN(contaIdNum)) notFound();

  const [cliente, conta, todosClientes] = await Promise.all([
    db.cliente.findUnique({
      where: { id: clienteId },
      select: { id: true, nome: true },
    }),
    db.clienteAtivo.findUnique({ where: { id: contaIdNum } }),
    db.cliente.findMany({
      orderBy: [{ ativo: "desc" }, { nome: "asc" }],
      select: { id: true, nome: true },
    }),
  ]);
  if (!cliente || !conta) notFound();

  // Sanity: a URL precisa bater com o parent atual da conta (evita confusão visual)
  if (conta.clienteId !== cliente.id) notFound();

  const contaData: ContaFormData = {
    id: conta.id,
    nome: conta.nome,
    metaAdAccountId: conta.metaAdAccountId ?? null,
    limiteMinimo: Number(conta.limiteMinimo),
    moeda: conta.moeda,
    receberAlertaSaldo: conta.receberAlertaSaldo,
    ativo: conta.ativo,
    googleAdCustomerId: conta.googleAdCustomerId ?? null,
    googleAdsMccId: conta.googleAdsMccId ?? null,
    limiteMinimoGoogle: Number(conta.limiteMinimoGoogle),
    receberAlertaGoogle: conta.receberAlertaGoogle,
  };

  const salvar = atualizarConta.bind(null, conta.id);
  const remover = excluirConta.bind(null, cliente.id, conta.id);

  const plataformas = [
    conta.metaAdAccountId ? "Meta Ads" : null,
    conta.googleAdCustomerId ? "Google Ads" : null,
  ]
    .filter(Boolean)
    .join(" + ");

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <Link
            href={`/clientes/${cliente.id}`}
            className="text-xs text-neutral-500 hover:underline"
          >
            ← {cliente.nome}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {conta.nome}
          </h1>
          <p className="text-sm text-neutral-500">
            {plataformas || "Sem plataforma configurada"}
          </p>
        </div>
        <form action={remover}>
          <button
            type="submit"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
          >
            Excluir conta
          </button>
        </form>
      </header>

      <div className="rounded-xl border border-neutral-200 bg-white p-6">
        <ContaForm
          conta={contaData}
          clienteIdAtual={cliente.id}
          clientesDisponiveis={todosClientes}
          action={salvar}
          submitLabel="Salvar alterações"
          backHref={`/clientes/${cliente.id}`}
        />
      </div>
    </div>
  );
}
