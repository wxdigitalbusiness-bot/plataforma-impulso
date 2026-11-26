"use client";

import { useTransition } from "react";
import { excluirLinkPage } from "../../_actions";

export function ExcluirBotao({ id }: { id: number }) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!window.confirm("Apagar esse QR Code? O link público para de funcionar — se já estiver impresso numa plaquinha/NFC, ela fica inválida. Essa ação não pode ser desfeita.")) return;
    startTransition(async () => { await excluirLinkPage(id); });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="text-xs font-medium text-red-500 hover:text-red-700 hover:underline disabled:opacity-50"
    >
      {pending ? "Apagando..." : "Apagar QR Code"}
    </button>
  );
}
