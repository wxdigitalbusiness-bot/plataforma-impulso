import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { togglePortalUsuario, resetSenhaPortalUsuario } from "./_actions";
import { CreatePortalUsuarioForm } from "./_create-form";

export const dynamic = "force-dynamic";

const ROLES: Record<string, string> = {
  admin:        "Admin",
  operador:     "Operador",
  visualizador: "Visualizador",
};

type Props = { params: Promise<{ id: string }> };

export default async function PortalUsuariosPage({ params }: Props) {
  const { id } = await params;
  const clienteId = Number(id);
  if (isNaN(clienteId)) notFound();

  const cliente = await db.cliente.findUnique({
    where: { id: clienteId },
    select: {
      nome: true,
      portalUsuarios: {
        orderBy: { criadoEm: "asc" },
        select: { id: true, nome: true, email: true, role: true, ativo: true, criadoEm: true },
      },
    },
  });
  if (!cliente) notFound();

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <header>
        <nav className="mb-1 flex items-center gap-1.5 text-xs text-neutral-400">
          <Link href="/" className="hover:text-neutral-600">Dashboard</Link>
          <span>/</span>
          <Link href="/clientes" className="hover:text-neutral-600">Clientes</Link>
          <span>/</span>
          <Link href={`/clientes/${clienteId}`} className="hover:text-neutral-600">{cliente.nome}</Link>
          <span>/</span>
          <span className="text-neutral-700">Portal</span>
        </nav>
        <h1 className="text-2xl font-semibold tracking-tight">Portal — {cliente.nome}</h1>
        <p className="mt-0.5 text-sm text-neutral-500">Gerencie os acessos do cliente ao portal.</p>
      </header>

      {/* Lista de usuários */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-neutral-700">Usuários cadastrados</h2>
        {cliente.portalUsuarios.length === 0 ? (
          <p className="text-sm text-neutral-400">Nenhum usuário cadastrado ainda.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-[10px] uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">E-mail</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {cliente.portalUsuarios.map((u) => (
                  <tr key={u.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 font-medium text-neutral-900">{u.nome}</td>
                    <td className="px-4 py-3 text-neutral-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        u.role === "admin"
                          ? "bg-violet-100 text-violet-700"
                          : u.role === "operador"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-neutral-100 text-neutral-600"
                      }`}>
                        {ROLES[u.role] ?? u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${u.ativo ? "text-emerald-600" : "text-red-500"}`}>
                        {u.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <form action={togglePortalUsuario.bind(null, u.id, u.ativo, clienteId)}>
                          <button type="submit" className="text-xs text-neutral-500 underline hover:text-neutral-700">
                            {u.ativo ? "Desativar" : "Ativar"}
                          </button>
                        </form>
                        <form action={resetSenhaPortalUsuario.bind(null, u.id, clienteId)} className="flex items-center gap-1.5">
                          <input
                            name="senha"
                            type="password"
                            required
                            minLength={6}
                            placeholder="Nova senha"
                            className="w-28 rounded border border-neutral-300 px-2 py-1 text-xs outline-none focus:border-violet-500"
                          />
                          <button type="submit" className="text-xs text-violet-600 underline hover:text-violet-800">
                            Trocar
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Formulário de criação */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-neutral-700">Adicionar usuário</h2>
        <CreatePortalUsuarioForm clienteId={clienteId} />
      </section>
    </div>
  );
}
