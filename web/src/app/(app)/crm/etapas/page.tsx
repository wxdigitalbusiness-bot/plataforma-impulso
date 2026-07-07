import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ClienteSeletor } from "@/components/crm/cliente-seletor";
import { EtapasClient } from "./_client";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ cliente?: string }> };

export default async function CrmEtapasPage({ searchParams }: Props) {
  const sp = await searchParams;

  const crmClientes = await db.cliente.findMany({
    where: { ativo: true, crmWebhooks: { some: {} } },
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });

  if (crmClientes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-neutral-400">
        Nenhum cliente com CRM configurado.
      </div>
    );
  }

  const clienteId = Number(sp.cliente);
  const clienteValido = crmClientes.some((c) => c.id === clienteId);

  if (!sp.cliente || !clienteValido) {
    redirect(`/crm/etapas?cliente=${crmClientes[0].id}`);
  }

  const etapas = await db.clienteCrmWebhook.findMany({
    where: { clienteId },
    select: { id: true, etapa: true, etapaLabel: true, ehExtra: true, tipoConversao: true },
    orderBy: [{ ehExtra: "asc" }, { criadoEm: "asc" }],
  });

  const etapasSerial = etapas.map((e) => ({ ...e, id: Number(e.id) }));

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Etapas do Funil</h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            Configure as colunas do Kanban para o cliente selecionado.
          </p>
        </div>
        <ClienteSeletor
          clientes={crmClientes}
          clienteAtualId={clienteId}
          basePath="/crm/etapas"
        />
      </div>

      <EtapasClient clienteId={clienteId} etapas={etapasSerial} />
    </div>
  );
}
