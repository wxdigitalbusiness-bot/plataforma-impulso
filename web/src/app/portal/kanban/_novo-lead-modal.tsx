"use client";

import { useActionState, useRef } from "react";

type Props = {
  clienteId: number;
  primeiraEtapaLabel: string;
  onClose: () => void;
};

type State = { error?: string; ok?: boolean } | null;

async function criarLead(_: State, formData: FormData): Promise<State> {
  const clienteId = Number(formData.get("clienteId"));
  const nome = formData.get("nome")?.toString().trim() ?? "";
  const whatsapp = formData.get("whatsapp")?.toString().replace(/\D/g, "") ?? "";
  const primeiraEtapaLabel = formData.get("primeiraEtapaLabel")?.toString() ?? "";

  if (!nome || !whatsapp) return { error: "Nome e WhatsApp são obrigatórios." };
  if (whatsapp.length < 10) return { error: "WhatsApp inválido." };

  const res = await fetch(`/api/crm/${clienteId}/leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nome, whatsapp, primeiraEtapaLabel }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    return { error: data.error ?? "Erro ao criar lead." };
  }

  return { ok: true };
}

export function NovoLeadModal({ clienteId, primeiraEtapaLabel, onClose }: Props) {
  const [state, action, pending] = useActionState(criarLead, null);
  const formRef = useRef<HTMLFormElement>(null);

  if (state?.ok) {
    // Recarrega para mostrar o novo lead no kanban
    window.location.reload();
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-neutral-900">Novo Lead</h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600"
          >
            ✕
          </button>
        </div>

        <form ref={formRef} action={action} className="space-y-4">
          <input type="hidden" name="clienteId" value={clienteId} />
          <input type="hidden" name="primeiraEtapaLabel" value={primeiraEtapaLabel} />

          {state?.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {state.error}
            </p>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-700">Nome</label>
            <input
              name="nome"
              type="text"
              required
              placeholder="Nome do lead"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-700">
              WhatsApp
            </label>
            <input
              name="whatsapp"
              type="tel"
              required
              placeholder="5511999999999"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
            />
            <p className="mt-1 text-[11px] text-neutral-400">Somente dígitos com DDI (ex: 5511999999999)</p>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-neutral-200 px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="flex-1 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60"
            >
              {pending ? "Criando…" : "Criar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
