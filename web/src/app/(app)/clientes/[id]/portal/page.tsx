import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ConvidarUsuario } from "./_convidar-usuario";
import { UsuarioRow } from "./_usuario-row";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

type PortalUser = {
  id: number;
  nome: string | null;
  email: string | null;
  telefone: string | null;
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
    SELECT id, nome, email, telefone, ativo, criado_em
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

      <ConvidarUsuario clienteId={clienteId} />

      <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
        {usuarios.length === 0 ? (
          <p className="p-6 text-sm text-neutral-400">Nenhum usuário convidado ainda.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-100 text-xs text-neutral-500">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Nome</th>
                <th className="px-4 py-3 text-left font-medium">Email</th>
                <th className="px-4 py-3 text-left font-medium">WhatsApp</th>
                <th className="px-4 py-3 text-left font-medium">Criado em</th>
                <th className="px-4 py-3 text-right font-medium">Ação / Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {usuarios.map((u) => (
                <UsuarioRow
                  key={u.id}
                  clienteId={clienteId}
                  id={u.id}
                  nome={u.nome}
                  email={u.email}
                  telefone={u.telefone}
                  ativo={u.ativo}
                  criadoEm={u.criado_em.toISOString()}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
