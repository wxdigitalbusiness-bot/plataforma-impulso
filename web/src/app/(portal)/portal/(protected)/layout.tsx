import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal-session";
import { logoutPortal } from "../_logout-action";
import { db } from "@/lib/db";
import Link from "next/link";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getPortalSession();
  if (!session) redirect("/portal/login");

  const [cliente, tarefasCount] = await Promise.all([
    db.cliente.findUnique({
      where: { id: session.clienteId },
      select: {
        nome: true,
        empresa: true,
        bio: true,
        fotoUrl: true,
        contas: { select: { metaAdAccountId: true, googleAdCustomerId: true } },
        crmWebhooks: { select: { id: true }, take: 1 },
        portalMostrarDashboard:   true,
        portalMostrarCrm:         true,
        portalMostrarRelatorios:  true,
        portalMostrarResultados:  true,
        portalMostrarHistorico:   true,
        portalMostrarDocumentos:  true,
        portalMostrarFaturamento: true,
      },
    }),
    db.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) AS count FROM crm_tarefas
      WHERE cliente_id = ${session.clienteId} AND visivel_portal = true
    `,
  ]);

  const hasMeta    = cliente?.contas.some((c) => c.metaAdAccountId) ?? false;
  const hasGoogle  = cliente?.contas.some((c) => c.googleAdCustomerId) ?? false;
  const hasCrm     = (cliente?.crmWebhooks.length ?? 0) > 0;
  const hasTarefas = Number(tarefasCount[0]?.count ?? 0) > 0;

  const NAV = [
    hasMeta   && cliente?.portalMostrarDashboard  && { href: "/portal/meta",        label: "Meta Ads" },
    hasGoogle && cliente?.portalMostrarDashboard  && { href: "/portal/google",      label: "Google Ads" },
    hasCrm    && cliente?.portalMostrarCrm        && { href: "/portal/leads",       label: "Leads" },
    hasTarefas && { href: "/portal/tarefas", label: "Tarefas" },
    cliente?.portalMostrarRelatorios  && { href: "/portal/relatorios",  label: "Relatórios" },
    cliente?.portalMostrarResultados  && { href: "/portal/resultados",  label: "Resultados" },
    cliente?.portalMostrarDocumentos  && { href: "/portal/documentos",  label: "Documentos" },
    cliente?.portalMostrarFaturamento && { href: "/portal/faturamento", label: "Faturamento" },
    cliente?.portalMostrarHistorico   && { href: "/portal/historico",   label: "O que fizemos" },
  ].filter(Boolean) as { href: string; label: string }[];

  const nome = cliente?.nome ?? session.clienteNome;
  const iniciais = nome.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-start justify-between gap-4 px-6 py-4">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 border-white bg-neutral-100 shadow-sm">
              {cliente?.fotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cliente.fotoUrl} alt={nome} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-neutral-400">
                  {iniciais || "?"}
                </div>
              )}
            </div>
            <div className="pt-0.5">
              <span className="text-xs font-medium uppercase tracking-widest text-violet-600">
                Área do Cliente
              </span>
              <p className="text-base font-semibold leading-tight text-neutral-900">{nome}</p>
              {cliente?.empresa && <p className="text-xs text-neutral-500">{cliente.empresa}</p>}
              {cliente?.bio && (
                <p className="mt-1 max-w-md text-xs text-neutral-500">{cliente.bio}</p>
              )}
            </div>
          </div>

          <form action={logoutPortal}>
            <button
              type="submit"
              className="rounded-lg px-3 py-1.5 text-sm text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
            >
              Sair
            </button>
          </form>
        </div>

        <nav className="hidden items-center gap-1 border-t border-neutral-100 px-6 py-2 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        {/* Mobile nav */}
        <div className="flex gap-1 overflow-x-auto border-t border-neutral-100 px-4 py-2 md:hidden">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
            >
              {n.label}
            </Link>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
