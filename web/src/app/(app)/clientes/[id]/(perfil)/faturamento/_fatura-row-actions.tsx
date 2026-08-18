"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { alternarPagamento, excluirFatura } from "./_fatura-actions";

export function FaturaRowActions({ faturaId, pago }: { faturaId: number; pago: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onTogglePago() {
    startTransition(async () => {
      await alternarPagamento(faturaId, !pago);
      router.refresh();
    });
  }

  function onExcluir() {
    if (!window.confirm("Excluir esta fatura? Essa ação não pode ser desfeita.")) return;
    startTransition(async () => {
      await excluirFatura(faturaId);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-end gap-3">
      <button
        type="button"
        onClick={onTogglePago}
        disabled={pending}
        className="text-xs font-medium text-neutral-700 hover:underline disabled:opacity-60"
      >
        {pago ? "marcar pendente" : "marcar pago"}
      </button>
      <button
        type="button"
        onClick={onExcluir}
        disabled={pending}
        className="text-xs font-medium text-red-600 hover:underline disabled:opacity-60"
      >
        excluir
      </button>
    </div>
  );
}
