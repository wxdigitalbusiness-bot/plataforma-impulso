import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ClienteForm, type ClienteFormData } from "../../_cliente-form";
import { atualizarCliente, excluirCliente } from "../../_cliente-actions";

type Props = { params: Promise<{ id: string }> };

export default async function EditarClientePage({ params }: Props) {
  const { id } = await params;
  const clienteId = Number(id);
  if (Number.isNaN(clienteId)) notFound();

  const cliente = await db.cliente.findUnique({
    where: { id: clienteId },
    include: { _count: { select: { contas: true } } },
  });
  if (!cliente) notFound();

  const clienteData: ClienteFormData = {
    id: cliente.id,
    nome: cliente.nome,
    empresa: cliente.empresa,
    whatsappAlerta: cliente.whatsappAlerta,
    tipoServico: cliente.tipoServico,
    ativo: cliente.ativo,
  };

  const salvar = atualizarCliente.bind(null, cliente.id);
  const remover = excluirCliente.bind(null, cliente.id);

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
            Editar cliente
          </h1>
          <p className="text-sm text-neutral-500">
            {cliente._count.contas}{" "}
            {cliente._count.contas === 1 ? "conta vinculada" : "contas vinculadas"}
          </p>
        </div>
        <form action={remover}>
          <button
            type="submit"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
            title="Exclui o cliente. As contas vinculadas perdem o vínculo mas não são apagadas."
          >
            Excluir cliente
          </button>
        </form>
      </header>

      <div className="rounded-xl border border-neutral-200 bg-white p-6">
        <ClienteForm
          cliente={clienteData}
          action={salvar}
          submitLabel="Salvar alterações"
          backHref={`/clientes/${cliente.id}`}
        />
      </div>
    </div>
  );
}
