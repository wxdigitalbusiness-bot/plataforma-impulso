// Form do Cliente (parent). Compartilhado por /novo e /editar.

import { TIPOS_SERVICO } from "./_servicos";

export type ClienteFormData = {
  id: number;
  nome: string;
  empresa: string | null;
  whatsappAlerta: string | null;
  tipoServico: string | null;
  n8nClientKey: string | null;
  ativo: boolean;
};

type Props = {
  cliente?: ClienteFormData;
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  backHref?: string;
};

export function ClienteForm({
  cliente,
  action,
  submitLabel,
  backHref = "/clientes",
}: Props) {
  return (
    <form action={action} className="space-y-5">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-neutral-700">
          Nome do cliente
        </span>
        <input
          name="nome"
          required
          autoFocus={!cliente}
          defaultValue={cliente?.nome ?? ""}
          placeholder="Ex.: Santesso"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
        />
        <p className="mt-1 text-xs text-neutral-400">
          Nome curto pra identificar o grupo. Ex.: marca, sobrenome do
          responsável, ou empresa-mãe.
        </p>
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-neutral-700">
          Empresa (razão social ou marca)
        </span>
        <input
          name="empresa"
          defaultValue={cliente?.empresa ?? ""}
          placeholder="Ex.: Santesso Indústria Ltda"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
        />
        <p className="mt-1 text-xs text-neutral-400">
          Aparece nos relatórios e alertas. Compartilhada por todas as contas
          deste cliente.
        </p>
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-neutral-700">
          Tipo de serviço
        </span>
        <select
          name="tipoServico"
          defaultValue={cliente?.tipoServico ?? ""}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
        >
          <option value="">— não definido —</option>
          {TIPOS_SERVICO.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-neutral-400">
          Qual serviço a agência presta para este cliente.
        </p>
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-neutral-700">
          WhatsApp para alertas (DDI+DDD+número)
        </span>
        <input
          name="whatsappAlerta"
          defaultValue={cliente?.whatsappAlerta ?? ""}
          placeholder="5511999999999"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
        />
        <p className="mt-1 text-xs text-neutral-400">
          Recebe os alertas de saldo baixo de qualquer conta deste cliente.
          Deixe em branco para desabilitar alertas.
        </p>
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-neutral-700">
          Chave n8n (client_key)
        </span>
        <input
          name="n8nClientKey"
          defaultValue={cliente?.n8nClientKey ?? ""}
          placeholder="Ex.: SC, altaconquista"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
        />
        <p className="mt-1 text-xs text-neutral-400">
          Chave usada pelos workflows n8n para identificar este cliente nas tabelas{" "}
          <code className="rounded bg-neutral-100 px-1">fb_meta_insights</code> e{" "}
          <code className="rounded bg-neutral-100 px-1">impulso.lead_current</code>.
          Preencha para habilitar dados de CRM no dashboard (ex.: <em>SC</em>, <em>altaconquista</em>).
        </p>
      </label>

      <label className="flex cursor-pointer items-center justify-between rounded-lg border border-neutral-200 bg-white px-4 py-3">
        <span className="text-sm font-medium text-neutral-700">
          Cliente ativo na agência
        </span>
        <input
          type="checkbox"
          name="ativo"
          defaultChecked={cliente?.ativo ?? true}
          className="h-5 w-5 rounded border-neutral-300 accent-neutral-900"
        />
      </label>

      <div className="flex items-center justify-end gap-3 pt-2">
        <a
          href={backHref}
          className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Cancelar
        </a>
        <button
          type="submit"
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
