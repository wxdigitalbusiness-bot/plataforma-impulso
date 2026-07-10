import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { criarPortalUsuario, togglePortalUsuario } from "./_actions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

type PortalUser = {
  id: number;
  nome: string;
  email: string;
  role: string;
  ativo: boolean;
  criado_em: Date;
};

export default async function ClientePortalPage({ params }: Props) {
  const { id } = await params;
  const clienteId = Number(id);
  if (Number.isNaN(clienteId)) notFound();

  const cliente = await db.cliente.findUnique({ where: { id: clienteId } });
  if (!cliente) notFound();

  const usuarios = await db.$queryRaw<PortalUser[]>`
    SELECT id, nome, email, role, ativo, criado_em
    FROM portal_usuarios
    WHERE cliente_id = ${clienteId}
    ORDER BY criado_em DESC
  `;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <Link href={`/clientes/${clienteId}`} className="text-xs text-neutral-500 hover:underline">
            ← {cliente.nome}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Área do Cliente</h1>
          <p className="text-sm text-neutral-500">Usuários de acesso ao portal do cliente</p>
        </div>
      </header>

      {/* Formulário novo usuário */}
      <div className="rounded-xl border border-neutral-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-neutral-700">Novo usuário</h2>
        <form action={criarPortalUsuario} className="flex flex-wrap gap-3">
          <input type="hidden" name="cliente_id" value={clienteId} />
          <input
            name="nome"
            placeholder="Nome"
            required
            className="flex-1 min-w-[140px] rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-violet-500"
          />
          <input
            name="email"
            type="email"
            placeholder="Email"
            required
            className="flex-1 min-w-[180px] rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-violet-500"
          />
          <input
            name="senha"
            type="password"
            placeholder="Senha"
            required
            minLength={6}
            className="w-[160px] rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-violet-500"
          />
          <button
            type="submit"
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
          >
            Criar
          </button>
        </form>
      </div>

      {/* Lista de usuários */}
      <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
        {usuarios.length === 0 ? (
          <p className="p-6 text-sm text-neutral-400">Nenhum usuário cadastrado.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-100 text-xs text-neutral-500">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Nome</th>
                <th className="px-4 py-3 text-left font-medium">Email</th>
                <th className="px-4 py-3 text-left font-medium">Criado em</th>
                <th className="px-4 py-3 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {usuarios.map((u) => (
                <tr key={u.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-2.5 font-medium text-neutral-800">{u.nome}</td>
                  <td className="px-4 py-2.5 text-neutral-500">{u.email}</td>
                  <td className="px-4 py-2.5 text-neutral-400">
                    {new Date(u.criado_em).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <form action={togglePortalUsuario} className="inline">
                      <input type="hidden" name="id" value={u.id} />
                      <input type="hidden" name="ativo" value={u.ativo ? "1" : "0"} />
                      <input type="hidden" name="cliente_id" value={clienteId} />
                      <button
                        type="submit"
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition ${
                          u.ativo
                            ? "bg-green-50 text-green-700 hover:bg-red-50 hover:text-red-700"
                            : "bg-neutral-100 text-neutral-500 hover:bg-green-50 hover:text-green-700"
                        }`}
                      >
                        {u.ativo ? "Ativo" : "Inativo"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
