"use client";

import { useState, useTransition } from "react";
import { completarAcesso } from "./_action";

type Props = {
  token: string;
  pendente: boolean;
  nomeAtual: string | null;
  emailAtual: string | null;
};

export function AcessoForm({ token, pendente, nomeAtual, emailAtual }: Props) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setErro(null);
    if (senha !== confirmar) {
      setErro("As senhas não coincidem.");
      return;
    }
    startTransition(async () => {
      const r = await completarAcesso(token, { nome, email, senha });
      if (r && !r.ok) setErro(r.erro);
    });
  }

  return (
    <form
      action={submit}
      className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm"
    >
      {erro && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-600">{erro}</p>
      )}

      {pendente ? (
        <>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Nome</label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10"
            />
          </div>
        </>
      ) : (
        <div className="rounded-lg bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
          {nomeAtual} — {emailAtual}
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700">Senha</label>
        <input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700">Confirmar senha</label>
        <input
          type="password"
          value={confirmar}
          onChange={(e) => setConfirmar(e.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-violet-600 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-60"
      >
        {pending ? "Salvando..." : pendente ? "Criar acesso" : "Redefinir senha"}
      </button>
    </form>
  );
}
