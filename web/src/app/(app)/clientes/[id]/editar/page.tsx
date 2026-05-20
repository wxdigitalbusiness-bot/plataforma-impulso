import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ClienteForm, type ClienteFormData } from "../../_cliente-form";
import { atualizarCliente, excluirCliente } from "../../actions";

type Props = { params: Promise<{ id: string }> };

export default async function EditarClientePage({ params }: Props) {
  const { id } = await params;
  const clienteId = Number(id);
  if (Number.isNaN(clienteId)) notFound();

  const cliente = await db.clienteAtivo.findUnique({ where: { id: clienteId } });
  if (!cliente) notFound();

  // Converter Decimal → number e Date → string antes de passar ao Client Component
  const clienteData: ClienteFormData = {
    id: cliente.id,
    nome: cliente.nome,
    empresa: cliente.empresa,
    metaAdAccountId: cliente.metaAdAccountId ?? null,
    whatsappAlerta: cliente.whatsappAlerta ?? null,
    limiteMinimo: Number(cliente.limiteMinimo),
    moeda: cliente.moeda,
    receberAlertaSaldo: cliente.receberAlertaSaldo,
    ativo: cliente.ativo,
    googleAdCustomerId: cliente.googleAdCustomerId ?? null,
    googleAdsMccId: cliente.googleAdsMccId ?? null,
    limiteMinimoGoogle: Number(cliente.limiteMinimoGoogle),
    receberAlertaGoogle: cliente.receberAlertaGoogle,
  };

  const salvar = atualizarCliente.bind(null, cliente.id);
  const remover = excluirCliente.bind(null, cliente.id);

  const plataformas = [
    cliente.metaAdAccountId ? "Meta Ads" : null,
    cliente.googleAdCustomerId ? "Google Ads" : null,
  ]
    .filter(Boolean)
    .join(" + ");

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{cliente.nome}</h1>
          <p className="text-sm text-neutral-500">
            {plataformas || "Sem plataforma configurada"} · {cliente.empresa}
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
        <ClienteForm cliente={clienteData} action={salvar} submitLabel="Salvar alterações" />
      </div>
    </div>
  );
}
