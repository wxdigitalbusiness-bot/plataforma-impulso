import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/clientes", label: "Clientes" },
  { href: "/panfletagem", label: "Panfletagem" },
  { href: "/alertas", label: "Histórico de alertas" },
  { href: "/bot", label: "Bot Marketing Impulso" },
  { href: "/whatsapp", label: "WhatsApp" },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 border-r border-neutral-200 bg-white p-5 md:flex md:flex-col">
        <div className="mb-8">
          <p className="text-base font-semibold tracking-tight">Plataforma Impulso</p>
          <p className="text-xs text-neutral-500">Agência Impulso</p>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm text-neutral-700 transition hover:bg-neutral-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto border-t border-neutral-200 pt-4">
          <p className="text-xs text-neutral-500">Logado como</p>
          <p className="truncate text-sm font-medium">{session.user.name ?? session.user.email}</p>
          <form action={logout}>
            <button
              type="submit"
              className="mt-3 w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100"
            >
              Sair
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
