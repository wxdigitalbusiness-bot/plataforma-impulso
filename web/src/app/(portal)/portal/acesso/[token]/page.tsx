import { db } from "@/lib/db";
import { AcessoForm } from "./_form";

export const metadata = { title: "Criar acesso — Área do Cliente" };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

type Row = {
  nome: string | null;
  email: string | null;
  ativo: boolean;
  token_expira_em: Date | null;
  cliente_nome: string | null;
};

export default async function AcessoPortalPage({ params }: Props) {
  const { token } = await params;

  const rows = await db.$queryRaw<Row[]>`
    SELECT pu.nome, pu.email, pu.ativo, pu.token_expira_em, c.nome AS cliente_nome
    FROM portal_usuarios pu
    JOIN clientes c ON c.id = pu.cliente_id
    WHERE pu.token = ${token}
    LIMIT 1
  `;
  const user = rows[0];

  const invalido = !user || !user.ativo;
  const expirado = user && (!user.token_expira_em || user.token_expira_em.getTime() < Date.now());

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            {user?.nome ? "Redefinir senha" : "Criar acesso"}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {user ? `Portal de ${user.cliente_nome}` : "Área do Cliente"}
          </p>
        </div>

        {invalido || expirado ? (
          <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
            <p className="text-sm text-neutral-600">
              {invalido
                ? "Esse link é inválido ou já foi usado."
                : "Esse link expirou. Peça pra agência reenviar o convite."}
            </p>
          </div>
        ) : (
          <AcessoForm
            token={token}
            pendente={!user.nome}
            nomeAtual={user.nome}
            emailAtual={user.email}
          />
        )}
      </div>
    </div>
  );
}
