"use client";

import { useActionState } from "react";
import { criarPortalUsuario } from "./_actions";

export function CreatePortalUsuarioForm({ clienteId }: { clienteId: number }) {
  const [state, action, pending] = useActionState(
    criarPortalUsuario.bind(null, clienteId),
    null,
  );

  return (
    <form action={action} className="rounded-xl border border-neutral-200 bg-white p-5">
      {state?.error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}
      {state?.ok && (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-600">Usuário adicionado com sucesso.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-neutral-700">Nome</label>
          <input
            name="nome"
            type="text"
            required
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-neutral-700">E-mail</label>
          <input
            name="email"
            type="email"
            required
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-neutral-700">Senha</label>
          <input
            name="senha"
            type="password"
            required
            minLength={6}
            placeholder="mín. 6 caracteres"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-neutral-700">Permissão</label>
          <select
            name="role"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
          >
            <option value="operador">Operador</option>
            <option value="admin">Admin</option>
            <option value="visualizador">Visualizador</option>
          </select>
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-violet-600 px-5 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60"
        >
          {pending ? "Adicionando…" : "Adicionar"}
        </button>
      </div>
    </form>
  );
}
