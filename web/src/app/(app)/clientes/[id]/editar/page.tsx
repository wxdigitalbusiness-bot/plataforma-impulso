import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ClienteForm } from "../../_cliente-form";
import { atualizarCliente, excluirCliente } from "../../actions";

type Props = { params: Promise<{ id: string }> };

export default async function EditarClientePage({ params }: Props) {
  const { id } = await params;
  const clienteId = Number(id);
  if (Number.isNaN(clienteId)) notFound();

  const cliente = await db.clienteAtivo.findUnique({ where: { id: clienteId } });
  if (!cliente) notFound();

  const salvar = atualizarCliente.bind(null, cliente.id);
  const remover = excluirCliente.bind(null, cliente.id);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{cliente.nome}</h1>
          <p className="text-sm text-neutral-500">
            Editando configuração da conta {cliente.metaAdAccountId}
          </p>
        </div>
        <form action={remover}>
          <button
            type="submit"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
          >
            Excluir cliente
          </button>
        </form>
      </header>

      <div className="rounded-xl border border-neutral-200 bg-white p-6">
        <ClienteForm cliente={cliente} action={salvar} submitLabel="Salvar alterações" />
      </div>
    </div>
  );
}
