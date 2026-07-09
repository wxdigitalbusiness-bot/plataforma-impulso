import { getPortalSession } from "@/lib/portal-auth";
import { logoutPortal } from "./login/_action";
import { redirect } from "next/navigation";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getPortalSession();
  if (!session) redirect("/portal/login");

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      {/* Nav bar */}
      <header className="flex shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-5 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold tracking-tight text-violet-700">IMPULSO</span>
          <span className="text-neutral-300">|</span>
          <span className="text-sm font-medium text-neutral-700">{session.clienteNome}</span>
        </div>

        <div className="flex items-center gap-4">
          <span className="hidden text-xs text-neutral-500 sm:block">
            {session.nome}
            {" · "}
            <span className="capitalize">{session.role}</span>
          </span>
          <form action={logoutPortal}>
            <button
              type="submit"
              className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 transition hover:bg-neutral-100"
            >
              Sair
            </button>
          </form>
        </div>
      </header>

      <main className="flex flex-1 flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}
