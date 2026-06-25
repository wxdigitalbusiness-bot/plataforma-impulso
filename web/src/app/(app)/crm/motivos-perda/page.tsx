import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ClienteSeletor } from "@/components/crm/cliente-seletor";
import { MotivosClient } from "./_client";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ cliente?: string }> };

type MotivoRow = { id: bigint; motivo: string };

export default async function CrmMotivosPage({ searchParams }: Props) {
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
    redirect(`/crm/motivos-perda?cliente=${crmClientes[0].id}`);
  }

  const cliente = await db.cliente.findUnique({
    where: { id: clienteId },
    select: { n8nClientKey: true },
  });

  const motivos: MotivoRow[] = cliente?.n8nClientKey
    ? await db.$queryRaw<MotivoRow[]>`
        SELECT id, motivo FROM crm_motivos_perda
        WHERE client_key = ${cliente.n8nClientKey}
        ORDER BY criado_em ASC
      `
    : [];

  const motivosSerial = motivos.map((m) => ({ id: Number(m.id), motivo: m.motivo }));

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Motivo de Perda</h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            Razões pré-cadastradas para leads marcados como perdidos.
          </p>
        </div>
        <ClienteSeletor
          clientes={crmClientes}
          clienteAtualId={clienteId}
          basePath="/crm/motivos-perda"
        />
      </div>

      <MotivosClient clienteId={clienteId} motivos={motivosSerial} />
    </div>
  );
}
