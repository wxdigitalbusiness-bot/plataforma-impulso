"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { MsgBubble } from "./msg-bubble";
import type { Lead } from "./lead-card";

type MensagemCrm = {
  id: string;
  de: "lead" | "atendente";
  tipo: string;
  conteudo: string | null;
  media_url: string | null;
  recebida_em: string;
};

type Etapa = {
  etapa: string;
  etapaLabel: string;
};

type Props = {
  clienteId: number;
  lead: Lead;
  etapas: Etapa[];
  onClose: () => void;
  onFaseChange: (leadId: string, novaFase: string, faseLabel: string) => void;
  onDelete: (leadId: string) => void;
};

function origemLabel(lead: Lead) {
  if (lead.gclid) return { label: "Google Ads", cls: "bg-blue-50 text-blue-600" };
  if (lead.source_app === "instagram") return { label: "Instagram", cls: "bg-pink-50 text-pink-600" };
  if (lead.source_app === "facebook" || lead.ad_id || lead.ctwa_clid)
    return { label: "Facebook", cls: "bg-blue-50 text-blue-500" };
  if (lead.utm_source === "site") return { label: "Site", cls: "bg-emerald-50 text-emerald-600" };
  return { label: "Orgânico", cls: "bg-neutral-100 text-neutral-500" };
}

export function ConversaPanel({ clienteId, lead, etapas, onClose, onFaseChange, onDelete }: Props) {
  const [mensagens, setMensagens] = useState<MensagemCrm[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [movendo, setMovendo] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchMensagens = useCallback(async () => {
    try {
      const res = await fetch(`/api/crm/${clienteId}/leads/${lead.lead_id}/mensagens`);
      if (!res.ok) return;
      const data = await res.json() as { mensagens: MensagemCrm[] };
      setMensagens(data.mensagens);
    } catch { /* ignora */ }
  }, [clienteId, lead.lead_id]);

  useEffect(() => {
    fetchMensagens();
    const interval = setInterval(fetchMensagens, 8000);
    return () => clearInterval(interval);
  }, [fetchMensagens]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim() || enviando) return;
    setEnviando(true);
    try {
      const res = await fetch(`/api/crm/${clienteId}/leads/${lead.lead_id}/enviar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: texto.trim() }),
      });
      if (res.ok) { setTexto(""); await fetchMensagens(); }
    } finally { setEnviando(false); }
  }

  async function mudarFase(etapa: Etapa) {
    if (movendo || etapa.etapaLabel === lead.fase) return;
    setMovendo(true);
    try {
      await fetch(`/api/crm/${clienteId}/leads/${lead.lead_id}/fase`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fase: etapa.etapa, faseLabel: etapa.etapaLabel }),
      });
      onFaseChange(lead.lead_id, etapa.etapa, etapa.etapaLabel);
    } finally { setMovendo(false); }
  }

  async function excluirLead() {
    const nome = lead.lead_nome || lead.lead_whatsapp;
    if (!confirm(`Excluir o lead "${nome}"? Esta ação não pode ser desfeita.`)) return;
    setExcluindo(true);
    try {
      await fetch(`/api/crm/${clienteId}/leads/${lead.lead_id}`, { method: "DELETE" });
      onDelete(lead.lead_id);
    } finally { setExcluindo(false); }
  }

  const origem = origemLabel(lead);

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-neutral-200 bg-white shadow-xl">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-neutral-100 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-neutral-900">{lead.lead_nome || "Sem nome"}</p>
          <p className="text-xs text-neutral-500">{lead.lead_whatsapp}</p>
          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${origem.cls}`}>
            {origem.label}
          </span>
        </div>
        <div className="ml-3 flex shrink-0 items-center gap-1">
          {/* Excluir */}
          <button
            onClick={excluirLead}
            disabled={excluindo}
            title="Excluir lead"
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          {/* Fechar */}
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Seletor de fase */}
      <div className="flex gap-1.5 overflow-x-auto border-b border-neutral-100 px-4 py-2">
        {etapas.map((e) => (
          <button
            key={e.etapa}
            onClick={() => mudarFase(e)}
            disabled={movendo}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              e.etapaLabel === lead.fase
                ? "bg-violet-600 text-white"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            {e.etapaLabel}
          </button>
        ))}
      </div>

      {/* Mensagens */}
      <div className="flex-1 space-y-2 overflow-y-auto bg-neutral-50 px-4 py-3">
        {mensagens.length === 0 ? (
          <p className="py-8 text-center text-sm text-neutral-400">Nenhuma mensagem registrada</p>
        ) : (
          mensagens.map((m) => (
            <MsgBubble
              key={m.id}
              de={m.de}
              tipo={m.tipo}
              conteudo={m.conteudo}
              mediaUrl={m.media_url}
              recebidaEm={new Date(m.recebida_em)}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input de envio */}
      <form onSubmit={enviar} className="flex items-end gap-2 border-t border-neutral-200 p-3">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(e as unknown as React.FormEvent); }
          }}
          placeholder="Mensagem… (Enter para enviar)"
          rows={1}
          className="flex-1 resize-none rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10"
        />
        <button
          type="submit"
          disabled={!texto.trim() || enviando}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </form>
    </div>
  );
}
