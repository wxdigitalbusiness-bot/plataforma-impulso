// Tipos de entrada do histórico do cliente ("prontuário").
// `portalPadrao` define se a entrada já nasce visível pro cliente — assim
// ninguém precisa pensar nisso na hora de registrar.
// `nuncaPortal` é barreira dura: a API rejeita visivel_portal=true nesses tipos.

export type HistoricoTipo = {
  valor: string;
  label: string;
  portalPadrao: boolean;
  nuncaPortal?: boolean;
  cor: string;
};

export const HISTORICO_TIPOS: HistoricoTipo[] = [
  { valor: "criativo",    label: "Criativo",    portalPadrao: true,  cor: "bg-violet-100 text-violet-700" },
  { valor: "campanha",    label: "Campanha",    portalPadrao: true,  cor: "bg-blue-100 text-blue-700" },
  { valor: "segmentacao", label: "Segmentação", portalPadrao: true,  cor: "bg-teal-100 text-teal-700" },
  { valor: "site",        label: "Site / LP",   portalPadrao: true,  cor: "bg-emerald-100 text-emerald-700" },
  { valor: "reuniao",     label: "Reunião",     portalPadrao: true,  cor: "bg-amber-100 text-amber-700" },
  { valor: "atendimento", label: "Atendimento", portalPadrao: true,  cor: "bg-sky-100 text-sky-700" },
  { valor: "orcamento",   label: "Orçamento",   portalPadrao: true,  cor: "bg-indigo-100 text-indigo-700" },
  { valor: "relatorio",   label: "Relatório",   portalPadrao: true,  cor: "bg-cyan-100 text-cyan-700" },
  { valor: "financeiro",  label: "Financeiro",  portalPadrao: false, cor: "bg-pink-100 text-pink-700" },
  { valor: "problema",    label: "Problema",    portalPadrao: false, nuncaPortal: true, cor: "bg-red-100 text-red-700" },
  { valor: "interno",     label: "Interno",     portalPadrao: false, nuncaPortal: true, cor: "bg-neutral-200 text-neutral-600" },
];

const TIPO_CUSTOM_MAX_LEN = 40;

/**
 * Tipos fora da lista fixa são permitidos (ex: criados livremente pelo usuário).
 * Sem correspondência exata (case-insensitive) → vira um tipo "custom" cujo
 * próprio valor dobra como label, já que não há coluna separada pra isso.
 */
export function tipoInfo(valorBruto: string): HistoricoTipo {
  const valor = valorBruto.trim();
  const conhecido = HISTORICO_TIPOS.find((t) => t.valor.toLowerCase() === valor.toLowerCase());
  if (conhecido) return conhecido;
  if (!valor) return tipoInfo("interno");
  return {
    valor: valor.slice(0, TIPO_CUSTOM_MAX_LEN),
    label: valor.slice(0, TIPO_CUSTOM_MAX_LEN),
    portalPadrao: false,
    cor: "bg-neutral-100 text-neutral-600",
  };
}

/** Regra única de visibilidade — usada pela API e pela UI. */
export function podeIrProPortal(tipo: string): boolean {
  return !tipoInfo(tipo).nuncaPortal;
}
