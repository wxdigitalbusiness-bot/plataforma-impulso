// Tipos de serviço oferecidos pela agência.
// Source of truth — usar em validação (Zod), UI (dropdown) e display (rótulos).

export const TIPOS_SERVICO = [
  { value: "panfletagem_digital", label: "Panfletagem Digital" },
  { value: "gestao_trafego",      label: "Gestão de Tráfego" },
  { value: "impulso_360",         label: "Impulso 360°" },
] as const;

export type TipoServicoValue = (typeof TIPOS_SERVICO)[number]["value"];

export const TIPOS_SERVICO_VALUES = TIPOS_SERVICO.map((t) => t.value) as readonly TipoServicoValue[];

export function tipoServicoLabel(value: string | null | undefined): string {
  if (!value) return "—";
  const found = TIPOS_SERVICO.find((t) => t.value === value);
  return found?.label ?? value;
}
