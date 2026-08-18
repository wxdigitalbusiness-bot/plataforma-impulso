"use client";

import { useState, useTransition } from "react";
import { alternarVisibilidadePortal, type AbaPortal } from "./_visibilidade-actions";

type Props = { clienteId: number; aba: AbaPortal; visivelInicial: boolean };

export function VisibilidadePortalToggle({ clienteId, aba, visivelInicial }: Props) {
  const [visivel, setVisivel] = useState(visivelInicial);
  const [pending, startTransition] = useTransition();

  function alternar() {
    const novo = !visivel;
    setVisivel(novo);
    startTransition(async () => {
      const r = await alternarVisibilidadePortal(clienteId, aba, novo);
      if (!r.ok) setVisivel(!novo);
    });
  }

  return (
    <button
      type="button"
      onClick={alternar}
      disabled={pending}
      title="Controla se o cliente vê esta aba no portal dele"
      className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-50 ${
        visivel
          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
          : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${visivel ? "bg-emerald-500" : "bg-neutral-400"}`} />
      {visivel ? "Visível pro cliente" : "Oculto pro cliente"}
    </button>
  );
}
