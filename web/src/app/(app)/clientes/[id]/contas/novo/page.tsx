import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ContaForm } from "../../../_conta-form";
import { criarConta } from "../../../_conta-actions";

type Props = { params: Promise<{ id: string }> };

export default async function NovaContaPage({ params }: Props) {
  const { id } = await params;
  const clienteId = Number(id);
  if (Number.isNaN(clienteId)) notFound();

  const cliente = await db.cliente.findUnique({
    where: { id: clienteId },
    select: { id: true, nome: true, empresa: true, whatsappAlerta: true },
  });
  if (!cliente) notFound();

  return (
    <div className="space-y-6">
      <header>
        <Link
          href={`/clientes/${cliente.id}`}
          className="text-xs text-neutral-500 hover:underline"
        >
          ← {cliente.nome}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Nova conta de anúncio
        </h1>
        <p className="text-sm text-neutral-500">
          Vinculada a <strong>{cliente.nome}</strong>
          {cliente.empresa && <span> · {cliente.empresa}</span>}
        </p>
      </header>

      <div className="rounded-xl border border-neutral-200 bg-white p-6">
        <ContaForm
          clienteIdAtual={cliente.id}
          action={criarConta}
          submitLabel="Criar conta"
          backHref={`/clientes/${cliente.id}`}
        />
      </div>
    </div>
  );
}
