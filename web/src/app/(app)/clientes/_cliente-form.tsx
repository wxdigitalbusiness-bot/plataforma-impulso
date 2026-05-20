import type { ClienteAtivo } from "@prisma/client";

type Props = {
  cliente?: ClienteAtivo;
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
};

export function ClienteForm({ cliente, action, submitLabel }: Props) {
  return (
    <form action={action} className="space-y-6">

      {/* ── Dados gerais ─────────────────────────────────────────────── */}
      <fieldset className="space-y-4">
        <legend className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Dados do cliente
        </legend>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field label="Nome do cliente" name="nome" defaultValue={cliente?.nome} required />
          <Field label="Empresa" name="empresa" defaultValue={cliente?.empresa} required />
          <Field
            label="WhatsApp para alertas (DDI+DDD+número)"
            name="whatsappAlerta"
            defaultValue={cliente?.whatsappAlerta ?? ""}
            placeholder="5511999999999"
          />
        </div>
      </fieldset>

      {/* ── Meta Ads ─────────────────────────────────────────────────── */}
      <fieldset className="space-y-4 rounded-xl border border-neutral-200 p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-blue-600">
          Meta Ads
        </legend>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field
            label="Ad Account ID (formato act_xxxxx)"
            name="metaAdAccountId"
            defaultValue={cliente?.metaAdAccountId}
            required
            placeholder="act_1234567890"
          />
          <Field
            label="Limite mínimo de saldo (R$)"
            name="limiteMinimo"
            type="number"
            step="0.01"
            defaultValue={cliente ? Number(cliente.limiteMinimo).toString() : "100"}
            required
          />
          <Field
            label="Moeda"
            name="moeda"
            defaultValue={cliente?.moeda ?? "BRL"}
            required
          />
        </div>
        <Toggle
          name="receberAlertaSaldo"
          label="Receber alerta de saldo baixo (Meta Ads)"
          defaultChecked={cliente?.receberAlertaSaldo ?? true}
        />
      </fieldset>

      {/* ── Google Ads ───────────────────────────────────────────────── */}
      <fieldset className="space-y-4 rounded-xl border border-neutral-200 p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-green-600">
          Google Ads
        </legend>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field
            label="Customer ID (somente números, ex: 1234567890)"
            name="googleAdCustomerId"
            defaultValue={cliente?.googleAdCustomerId ?? ""}
            placeholder="1234567890"
          />
          <Field
            label="Limite mínimo de saldo Google (R$)"
            name="limiteMinimoGoogle"
            type="number"
            step="0.01"
            defaultValue={
              cliente ? Number(cliente.limiteMinimoGoogle).toString() : "100"
            }
            required
          />
        </div>
        <Toggle
          name="receberAlertaGoogle"
          label="Receber alerta de saldo baixo (Google Ads)"
          defaultChecked={cliente?.receberAlertaGoogle ?? false}
        />
      </fieldset>

      {/* ── Status ───────────────────────────────────────────────────── */}
      <Toggle
        name="ativo"
        label="Cliente ativo na agência"
        defaultChecked={cliente?.ativo ?? true}
      />

      <div className="flex items-center justify-end gap-3 pt-2">
        <a
          href="/clientes"
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

function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-neutral-700">
        {label}
      </span>
      <input
        {...props}
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
      />
    </label>
  );
}

function Toggle({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-lg border border-neutral-200 bg-white px-4 py-3">
      <span className="text-sm font-medium text-neutral-700">{label}</span>
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-5 w-5 rounded border-neutral-300 accent-neutral-900"
      />
    </label>
  );
}
