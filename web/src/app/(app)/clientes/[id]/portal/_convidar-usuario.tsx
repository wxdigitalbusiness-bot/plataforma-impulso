"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { convidarPortalUsuario } from "./_actions";

export function ConvidarUsuario({ clienteId }: { clienteId: number }) {
  const router = useRouter();
  const [telefone, setTelefone] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, startTransition] = useTransition();

  function enviar() {
    setErro(null);
    setOk(false);
    startTransition(async () => {
      const r = await convidarPortalUsuario(clienteId, telefone);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setOk(true);
      setTelefone("");
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6">
      <h2 className="mb-1 text-sm font-semibold text-neutral-700">Convidar novo usuário</h2>
      <p className="mb-4 text-xs text-neutral-500">
        Mande o link de acesso pro WhatsApp do cliente — ele escolhe o próprio nome, email e senha.
      </p>
      <div className="flex flex-wrap gap-3">
        <input
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          placeholder="WhatsApp (ex.: (63) 98438-6017)"
          className="flex-1 min-w-[200px] rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-violet-500"
        />
        <button
          type="button"
          onClick={enviar}
          disabled={pending || !telefone}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
        >
          {pending ? "Enviando..." : "Enviar convite"}
        </button>
      </div>
      {erro && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</p>}
      {ok && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">Convite enviado por WhatsApp.</p>}
    </div>
  );
}
