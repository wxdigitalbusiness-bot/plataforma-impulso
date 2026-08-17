"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { excluirDocumento } from "./_documento-actions";

export function ExcluirDocumento({ documentoId }: { documentoId: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!window.confirm("Excluir este documento? Essa ação não pode ser desfeita.")) return;
    startTransition(async () => {
      await excluirDocumento(documentoId);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="text-xs font-medium text-red-600 hover:underline disabled:opacity-60"
    >
      {pending ? "excluindo..." : "excluir"}
    </button>
  );
}
