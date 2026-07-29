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
  { valor: "problema",    label: "Problema",    portalPadrao: false, nuncaPortal: true, cor: "bg-red-100 text-red-700" },
  { valor: "interno",     label: "Interno",     portalPadrao: false, nuncaPortal: true, cor: "bg-neutral-200 text-neutral-600" },
];

export function tipoInfo(valor: string): HistoricoTipo {
  return HISTORICO_TIPOS.find((t) => t.valor === valor) ?? HISTORICO_TIPOS[HISTORICO_TIPOS.length - 1];
}

/** Regra única de visibilidade — usada pela API e pela UI. */
export function podeIrProPortal(tipo: string): boolean {
  return !tipoInfo(tipo).nuncaPortal;
}
