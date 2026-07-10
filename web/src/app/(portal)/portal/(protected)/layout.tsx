import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal-session";
import { logoutPortal } from "../_logout-action";
import { db } from "@/lib/db";
import Link from "next/link";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getPortalSession();
  if (!session) redirect("/portal/login");

  const cliente = await db.cliente.findUnique({
    where: { id: session.clienteId },
    select: {
      contas: { select: { metaAdAccountId: true, googleAdCustomerId: true } },
      crmWebhooks: { select: { id: true }, take: 1 },
    },
  });

  const hasMeta   = cliente?.contas.some((c) => c.metaAdAccountId) ?? false;
  const hasGoogle = cliente?.contas.some((c) => c.googleAdCustomerId) ?? false;
  const hasCrm    = (cliente?.crmWebhooks.length ?? 0) > 0;

  const NAV = [
    hasMeta   && { href: "/portal/meta",       label: "Meta Ads" },
    hasGoogle && { href: "/portal/google",     label: "Google Ads" },
    hasCrm    && { href: "/portal/leads",      label: "Leads" },
                  { href: "/portal/relatorios", label: "Relatórios" },
  ].filter(Boolean) as { href: string; label: string }[];

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div>
            <span className="text-xs font-medium uppercase tracking-widest text-violet-600">
              Área do Cliente
            </span>
            <p className="text-base font-semibold text-neutral-900 leading-tight">
              {session.clienteNome}
            </p>
          </div>

          <nav className="hidden items-center gap-1 md:flex">
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

          <form action={logoutPortal}>
            <button
              type="submit"
              className="rounded-lg px-3 py-1.5 text-sm text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
            >
              Sair
            </button>
          </form>
        </div>

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
