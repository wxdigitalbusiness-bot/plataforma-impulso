"use client";

import { useState } from "react";
import type { ClienteAtivo } from "@prisma/client";

type Props = {
  cliente?: ClienteAtivo;
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
};

export function ClienteForm({ cliente, action, submitLabel }: Props) {
  const temMeta = !!(cliente?.metaAdAccountId);
  const temGoogle = !!(cliente?.googleAdCustomerId);

  const [usaMeta, setUsaMeta] = useState(temMeta || (!temMeta && !temGoogle));
  const [usaGoogle, setUsaGoogle] = useState(temGoogle);
  const [erro, setErro] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!usaMeta && !usaGoogle) {
      e.preventDefault();
      setErro("Selecione ao menos uma plataforma (Meta Ads ou Google Ads).");
      return;
    }
    setErro(null);
  }

  return (
    <form action={action} onSubmit={handleSubmit} className="space-y-6">

      {/* ── Dados gerais ─────────────────────────────────────────────── */}
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

      {/* ── Seletor de plataformas ────────────────────────────────────── */}
      <div>
        <p className="mb-2 text-sm font-medium text-neutral-700">
          Plataformas de anúncio <span className="text-red-500">*</span>
        </p>
        <div className="flex flex-wrap gap-3">
          <PlatformToggle
            id="usa-meta"
            label="Meta Ads"
            color="blue"
            checked={usaMeta}
            onChange={setUsaMeta}
          />
          <PlatformToggle
            id="usa-google"
            label="Google Ads"
            color="green"
            checked={usaGoogle}
            onChange={setUsaGoogle}
          />
        </div>
        {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
      </div>

      {/* ── Meta Ads ─────────────────────────────────────────────────── */}
      {usaMeta && (
        <fieldset className="space-y-4 rounded-xl border border-blue-200 bg-blue-50/30 p-4">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-blue-600">
            Meta Ads
          </legend>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Field
              label="Ad Account ID"
              name="metaAdAccountId"
              defaultValue={cliente?.metaAdAccountId ?? ""}
              placeholder="act_1234567890"
              required={usaMeta}
            />
            <Field
              label="Limite mínimo de saldo (R$)"
              name="limiteMinimo"
              type="number"
              step="0.01"
              defaultValue={cliente ? Number(cliente.limiteMinimo).toString() : "100"}
              required={usaMeta}
            />
            <Field
              label="Moeda"
              name="moeda"
              defaultValue={cliente?.moeda ?? "BRL"}
            />
          </div>
          <Toggle
            name="receberAlertaSaldo"
            label="Receber alerta de saldo baixo (Meta Ads)"
            defaultChecked={cliente?.receberAlertaSaldo ?? true}
          />
        </fieldset>
      )}

      {/* ── Google Ads ───────────────────────────────────────────────── */}
      {usaGoogle && (
        <fieldset className="space-y-4 rounded-xl border border-green-200 bg-green-50/30 p-4">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-green-600">
            Google Ads
          </legend>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Field
              label="Customer ID (somente números)"
              name="googleAdCustomerId"
              defaultValue={cliente?.googleAdCustomerId ?? ""}
              placeholder="1234567890"
              required={usaGoogle}
            />
            <Field
              label="Limite mínimo de saldo (R$)"
              name="limiteMinimoGoogle"
              type="number"
              step="0.01"
              defaultValue={cliente ? Number(cliente.limiteMinimoGoogle).toString() : "100"}
              required={usaGoogle}
            />
            <div>
              <Field
                label="MCC ID (deixe em branco para usar o padrão da agência)"
                name="googleAdsMccId"
                defaultValue={cliente?.googleAdsMccId ?? ""}
                placeholder="8259939796"
              />
              <p className="mt-1 text-xs text-neutral-400">
                Preencha apenas se este cliente pertence a um MCC diferente do padrão (WX: 825-993-9796)
              </p>
            </div>
          </div>
          <Toggle
            name="receberAlertaGoogle"
            label="Receber alerta de saldo baixo (Google Ads)"
            defaultChecked={cliente?.receberAlertaGoogle ?? false}
          />
        </fieldset>
      )}

      {/* ── Status ───────────────────────────────────────────────────── */}
      <Toggle
        name="ativo"
        label="Cliente ativo na agência"
        defaultChecked={cliente?.ativo ?? true}
      />

      {/* Campos ocultos para enviar "false" quando a plataforma está desligada */}
      {!usaMeta && <input type="hidden" name="metaAdAccountId" value="" />}
      {!usaGoogle && <input type="hidden" name="googleAdCustomerId" value="" />}

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

// ─── Componentes auxiliares ──────────────────────────────────────────────────

function PlatformToggle({
  id,
  label,
  color,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  color: "blue" | "green";
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const activeClass =
    color === "blue"
      ? "border-blue-500 bg-blue-50 text-blue-700"
      : "border-green-500 bg-green-50 text-green-700";
  const inactiveClass =
    "border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300";

  return (
    <label
      htmlFor={id}
      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
        checked ? activeClass : inactiveClass
      }`}
    >
      <input
        id={id}
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        className={`h-2 w-2 rounded-full ${
          color === "blue" ? "bg-blue-500" : "bg-green-500"
        } ${checked ? "opacity-100" : "opacity-30"}`}
      />
      {label}
    </label>
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
