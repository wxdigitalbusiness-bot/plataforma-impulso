import { loginPortal } from "./_action";

export const metadata = { title: "Área do Cliente — Login" };

type Props = { searchParams: Promise<{ e?: string }> };

export default async function PortalLoginPage({ searchParams }: Props) {
  const sp = await searchParams;
  const erro = sp.e ? "Email ou senha incorretos." : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            Área do Cliente
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Acesse os resultados das suas campanhas
          </p>
        </div>

        <form action={loginPortal} className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
          {erro && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-600">
              {erro}
            </p>
          )}

          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-neutral-700">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10"
            />
          </div>

          <div>
            <label htmlFor="senha" className="mb-1 block text-sm font-medium text-neutral-700">
              Senha
            </label>
            <input
              id="senha"
              name="senha"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-violet-600 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700"
          >
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}
