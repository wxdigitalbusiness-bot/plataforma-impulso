import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { FotoPerfil } from "./_foto-perfil";
import { TabNav, type TabItem } from "./_tab-nav";

type Props = { children: React.ReactNode; params: Promise<{ id: string }> };

export default async function PerfilClienteLayout({ children, params }: Props) {
  const { id } = await params;
  const clienteId = Number(id);
  if (Number.isNaN(clienteId)) notFound();

  const cliente = await db.cliente.findUnique({
    where: { id: clienteId },
    select: {
      id: true,
      nome: true,
      empresa: true,
      bio: true,
      fotoUrl: true,
      tipoServico: true,
      ativo: true,
      crmWebhooks: { select: { id: true }, take: 1 },
    },
  });
  if (!cliente) notFound();

  const base = `/clientes/${cliente.id}`;
  const hasCrm = cliente.crmWebhooks.length > 0;
  const dashboardHref = cliente.tipoServico === "panfletagem_digital" ? `${base}/panfletagem` : `${base}/performance`;

  const tabs: TabItem[] = [
    { href: base, label: "Visão Geral", exact: true },
    { href: dashboardHref, label: "Dashboard" },
    ...(hasCrm ? [{ href: `${base}/crm`, label: "CRM" }] : []),
    { href: `${base}/relatorios`, label: "Relatórios" },
    ...(hasCrm ? [{ href: `${base}/resultados`, label: "Resultados" }] : []),
    { href: `${base}/documentos`, label: "Documentos" },
    { href: `${base}/historico`, label: "Histórico" },
  ];

  return (
    <div className="space-y-0">
      <header className="space-y-4 pb-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-5">
            <FotoPerfil clienteId={cliente.id} fotoUrl={cliente.fotoUrl} nome={cliente.nome} />
            <div className="pt-1">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
                  {cliente.nome}
                </h1>
                {!cliente.ativo && (
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                    inativo
                  </span>
                )}
              </div>
              {cliente.empresa && (
                <p className="text-sm text-neutral-500">{cliente.empresa}</p>
              )}
              {cliente.bio && (
                <p className="mt-2 max-w-xl text-sm text-neutral-700">{cliente.bio}</p>
              )}
            </div>
          </div>
          <Link
            href={`${base}/editar`}
            className="shrink-0 rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Editar cliente
          </Link>
        </div>

        <TabNav tabs={tabs} />
      </header>

      <div className="pt-6">{children}</div>
    </div>
  );
}
