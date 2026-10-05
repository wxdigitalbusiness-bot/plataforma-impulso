"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reenviarConvite, togglePortalUsuario } from "./_actions";

type Props = {
  clienteId: number;
  id: number;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  ativo: boolean;
  criadoEm: string;
};

export function UsuarioRow({ clienteId, id, nome, email, telefone, ativo, criadoEm }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const pendente = !nome;

  function onReenviar() {
    setErro(null);
    startTransition(async () => {
      const r = await reenviarConvite(id, clienteId);
      if (!r.ok) setErro(r.erro);
      router.refresh();
    });
  }

  function onToggle() {
    startTransition(async () => {
      await togglePortalUsuario(id, clienteId, ativo);
      router.refresh();
    });
  }

  return (
    <tr className="hover:bg-neutral-50">
      <td className="px-4 py-2.5 font-medium text-neutral-800">
        {pendente ? <span className="text-neutral-400">Convite pendente</span> : nome}
      </td>
      <td className="px-4 py-2.5 text-neutral-500">{email ?? "—"}</td>
      <td className="px-4 py-2.5 text-neutral-500">{telefone ?? "—"}</td>
      <td className="px-4 py-2.5 text-neutral-400">
        {new Date(criadoEm).toLocaleDateString("pt-BR")}
      </td>
      <td className="px-4 py-2.5 text-right">
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onReenviar}
            disabled={pending}
            className="text-xs font-medium text-violet-600 hover:underline disabled:opacity-60"
          >
            {pending ? "..." : pendente ? "Reenviar convite" : "Redefinir senha"}
          </button>
          <button
            type="button"
            onClick={onToggle}
            disabled={pending}
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition ${
              ativo
                ? "bg-green-50 text-green-700 hover:bg-red-50 hover:text-red-700"
                : "bg-neutral-100 text-neutral-500 hover:bg-green-50 hover:text-green-700"
            }`}
          >
            {ativo ? "Ativo" : "Inativo"}
          </button>
        </div>
        {erro && <p className="mt-1 text-right text-[11px] text-red-600">{erro}</p>}
      </td>
    </tr>
  );
}
