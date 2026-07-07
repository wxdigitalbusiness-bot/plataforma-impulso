"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adicionarEtapa, removerEtapa, salvarTipoConversao } from "./_actions";

type Etapa = { id: number; etapa: string; etapaLabel: string; ehExtra: boolean; tipoConversao: string | null };

const ORDEM_BASE = ["novo_lead", "nao_classificado", "qualificado", "perdido", "concluido"];

const TIPO_LABEL: Record<string, string> = {
  "":           "Nenhum",
  qualificado:  "Lead qualificado",
  concluido:    "Negócio concluído",
};

export function EtapasClient({
  clienteId,
  etapas,
}: {
  clienteId: number;
  etapas: Etapa[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [novaLabel, setNovaLabel] = useState("");
  const [mostrandoForm, setMostrandoForm] = useState(false);

  const base = ORDEM_BASE.map((slug) => etapas.find((e) => e.etapa === slug)).filter(
    (e): e is Etapa => !!e,
  );
  const extras = etapas.filter((e) => e.ehExtra);

  function adicionar() {
    const label = novaLabel.trim();
    if (!label) { setErro("Digite o nome da etapa."); return; }
    setErro(null);
    startTransition(async () => {
      const r = await adicionarEtapa(clienteId, label);
      if (r.ok) {
        setNovaLabel("");
        setMostrandoForm(false);
        router.refresh();
      } else {
        setErro(r.erro);
      }
    });
  }

  function remover(id: number, label: string) {
    if (!confirm(`Remover a etapa "${label}"? Os leads nessa etapa continuarão no banco, mas não aparecerão em nenhuma coluna.`)) return;
    setErro(null);
    startTransition(async () => {
      const r = await removerEtapa(id);
      if (r.ok) router.refresh();
      else setErro(r.erro);
    });
  }

  function alterarTipo(id: number, tipo: string) {
    startTransition(async () => {
      await salvarTipoConversao(id, tipo);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {erro && (
        <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{erro}</p>
      )}

      {/* Etapas base */}
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
          Etapas base (fixas)
        </p>
        <div className="space-y-1.5">
          {base.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between rounded-xl border border-neutral-100 bg-white px-4 py-2.5"
            >
              <span className="text-sm font-medium text-neutral-700">{e.etapaLabel}</span>
              <div className="flex items-center gap-3">
                <select
                  value={e.tipoConversao ?? ""}
                  disabled={pending}
                  onChange={(ev) => alterarTipo(e.id, ev.target.value)}
                  className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs text-neutral-700 focus:border-violet-400 focus:outline-none disabled:opacity-50"
                  title="Tipo de conversão Google Ads"
                >
                  <option value="">Nenhum</option>
                  <option value="qualificado">Lead qualificado</option>
                  <option value="concluido">Negócio concluído</option>
                </select>
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-400">
                  Base
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Etapas extras */}
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
          Etapas extras
        </p>

        {extras.length === 0 && !mostrandoForm && (
          <p className="text-sm text-neutral-400">Nenhuma etapa extra adicionada.</p>
        )}

        <div className="space-y-1.5">
          {extras.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between rounded-xl border border-neutral-100 bg-white px-4 py-2.5"
            >
              <span className="text-sm font-medium text-neutral-700">{e.etapaLabel}</span>
              <div className="flex items-center gap-3">
                <select
                  value={e.tipoConversao ?? ""}
                  disabled={pending}
                  onChange={(ev) => alterarTipo(e.id, ev.target.value)}
                  className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs text-neutral-700 focus:border-violet-400 focus:outline-none disabled:opacity-50"
                  title="Tipo de conversão Google Ads"
                >
                  <option value="">Nenhum</option>
                  <option value="qualificado">Lead qualificado</option>
                  <option value="concluido">Negócio concluído</option>
                </select>
                <button
                  onClick={() => remover(e.id, e.etapaLabel)}
                  disabled={pending}
                  className="rounded-lg px-2.5 py-1 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors"
                >
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3">
          {mostrandoForm ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={novaLabel}
                onChange={(e) => setNovaLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") adicionar(); if (e.key === "Escape") { setMostrandoForm(false); setNovaLabel(""); } }}
                placeholder='Ex: "Em negociação"'
                autoFocus
                className="flex-1 rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/10"
              />
              <button
                onClick={adicionar}
                disabled={pending || !novaLabel.trim()}
                className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {pending ? "..." : "Adicionar"}
              </button>
              <button
                onClick={() => { setMostrandoForm(false); setNovaLabel(""); setErro(null); }}
                className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setMostrandoForm(true)}
              className="text-sm font-medium text-violet-600 hover:text-violet-700"
            >
              + Adicionar etapa
            </button>
          )}
        </div>
      </div>

      <p className="text-[11px] text-neutral-400">
        <strong>Tipo de conversão:</strong> define qual ação Google Ads é disparada quando um lead entra nessa etapa.
        Configure os IDs de conversão em cada cliente.
      </p>
    </div>
  );
}
