import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  // Clientes com CRM configurado para o dropdown do menu
  const crmClientes = await db.cliente.findMany({
    where: { ativo: true, crmWebhooks: { some: {} } },
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });

  return (
    <AppShell
      userName={session.user.name ?? session.user.email ?? ""}
      crmClientes={crmClientes}
      logoutAction={logout}
      buildLabel={process.env.BUILD_LABEL ?? "dev"}
    >
      {children}
    </AppShell>
  );
}
