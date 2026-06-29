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

type Tag = { id: string; nome: string; cor: string };

type Atribuicao = {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  gclid: string | null;
};

type Reentrada = {
  id: string;
  fase_anterior: string;
  reentrada_em: string;
  ad_id: string | null;
  ctwa_clid: string | null;
  source_app: string | null;
};

type EventoHistorico = {
  id: string;
  etapa: string;
  tipo: string;          // 'entrada' | 'transicao' | 'reentrada'
  origem: string | null;
  ad_id: string | null;
  ctwa_clid: string | null;
  fase_anterior: string | null;
  entrou_em: string;
  saiu_em: string | null;
};

type HistoricoLead = {
  ad_name: string | null;
  adset_name: string | null;
  campaign_name: string | null;
  ad_title: string | null;
  source_app: string | null;
};

type MetaAdInfo = {
  adId: string;
  adNome: string | null;
  adSetId: string | null;
  adSetNome: string | null;
  campanhaId: string | null;
  campanhaNome: string | null;
};

type Detalhes = {
  observacoes: string | null;
  valor_negociacao: number | null;
};

type Etapa = { etapa: string; etapaLabel: string };

type Props = {
  clienteId: number;
  lead: Lead;
  etapas: Etapa[];
  onClose: () => void;
  onFaseChange: (leadId: string, novaFase: string, faseLabel: string) => void;
  onDelete: (leadId: string) => void;
};

function origemLabel(lead: Lead) {
  if (lead.gclid)                      return { label: "Google Ads", cls: "bg-blue-50 text-blue-600" };
  if (lead.ad_id || lead.ctwa_clid)    return { label: "Meta Ads",   cls: "bg-blue-50 text-blue-500" };
  if (lead.utm_source === "site")      return { label: "Site",        cls: "bg-emerald-50 text-emerald-600" };
  return { label: "Orgânico", cls: "bg-neutral-100 text-neutral-500" };
}

const COR_OPCOES = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#3b82f6", "#6b7280",
];

export function ConversaPanel({ clienteId, lead, etapas, onClose, onFaseChange, onDelete }: Props) {
  const [aba, setAba] = useState<"conversa" | "detalhes" | "origem" | "historico">("conversa");

  // Conversa
  const [mensagens, setMensagens] = useState<MensagemCrm[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const bottomRef       = useRef<HTMLDivElement>(null);
  const scrollContainer = useRef<HTMLDivElement>(null);
  const isFirstLoad     = useRef(true);

  // Fase
  const [movendo, setMovendo] = useState(false);

  // Exclusão
  const [excluindo, setExcluindo] = useState(false);

  // Detalhes
  const [detalhes, setDetalhes] = useState<Detalhes>({ observacoes: null, valor_negociacao: null });
  const [salvando, setSalvando] = useState(false);
  const [salvoOk, setSalvoOk] = useState(false);

  // Tags
  const [tagsLead, setTagsLead] = useState<Tag[]>([]);
  const [todasTags, setTodasTags] = useState<Tag[]>([]);
  const [mostrarAddTag, setMostrarAddTag] = useState(false);
  const [criandoTag, setCriandoTag] = useState(false);
  const [novaTagNome, setNovaTagNome] = useState("");
  const [novaTagCor, setNovaTagCor] = useState(COR_OPCOES[0]);
  const addTagRef = useRef<HTMLDivElement>(null);

  // Origem
  const [atribuicao, setAtribuicao] = useState<Atribuicao | null>(null);
  const [metaAdInfo, setMetaAdInfo] = useState<MetaAdInfo | null | "loading" | "error">(null);

  // Re-entradas
  const [reentradas, setReentradas] = useState<Reentrada[] | null>(null);

  // Histórico de etapas
  const [historicoEventos, setHistoricoEventos] = useState<EventoHistorico[] | null>(null);
  const [historicoLead, setHistoricoLead]       = useState<HistoricoLead | null>(null);

  // ─── Fetch mensagens ───────────────────────────────────────────────────────
  const fetchMensagens = useCallback(async () => {
    try {
      const res = await fetch(`/api/crm/${clienteId}/leads/${lead.lead_id}/mensagens`);
      if (!res.ok) return;
      const data = await res.json() as { mensagens: MensagemCrm[] };
      setMensagens(data.mensagens);
    } catch { /* ignora */ }
  }, [clienteId, lead.lead_id]);

  useEffect(() => {
    isFirstLoad.current = true;
    fetchMensagens();
    const iv = setInterval(fetchMensagens, 8000);
    return () => clearInterval(iv);
  }, [fetchMensagens]);

  // Scroll inteligente: na primeira carga vai direto ao fundo; nas atualizações
  // automáticas só rola se o usuário já estiver perto do final (≤ 120 px).
  useEffect(() => {
    const container = scrollContainer.current;
    if (!container || mensagens.length === 0) return;
    if (isFirstLoad.current) {
      container.scrollTop = container.scrollHeight;
      isFirstLoad.current = false;
      return;
    }
    const distToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distToBottom <= 120) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [mensagens]);

  // ─── Fetch detalhes / tags / atribuição ────────────────────────────────────
  const fetchDetalhes = useCallback(async () => {
    try {
      const res = await fetch(`/api/crm/${clienteId}/leads/${lead.lead_id}`);
      if (!res.ok) return;
      const data = await res.json() as {
        detalhes: Detalhes;
        tags: Tag[];
        atribuicao: Atribuicao | null;
      };
      setDetalhes(data.detalhes);
      setTagsLead(data.tags);
      setAtribuicao(data.atribuicao);
    } catch { /* ignora */ }
  }, [clienteId, lead.lead_id]);

  const fetchTodasTags = useCallback(async () => {
    try {
      const res = await fetch(`/api/crm/${clienteId}/tags`);
      if (!res.ok) return;
      const data = await res.json() as { tags: Tag[] };
      setTodasTags(data.tags);
    } catch { /* ignora */ }
  }, [clienteId]);

  useEffect(() => {
    if (aba === "detalhes" || aba === "origem") {
      fetchDetalhes();
      fetchTodasTags();
    }
    // Busca da API apenas como fallback para leads sem dados no banco (legados)
    if (aba === "origem" && lead.ad_id && !lead.campaign_name && metaAdInfo === null) {
      setMetaAdInfo("loading");
      fetch(`/api/crm/${clienteId}/leads/${lead.lead_id}/meta-attribution?adId=${encodeURIComponent(lead.ad_id)}`)
        .then((r) => r.json())
        .then((data: MetaAdInfo & { error?: string }) => {
          if (data.error) setMetaAdInfo("error");
          else setMetaAdInfo(data);
        })
        .catch(() => setMetaAdInfo("error"));
    }
  }, [aba, fetchDetalhes, fetchTodasTags, clienteId, lead.ad_id, lead.lead_id, metaAdInfo]);

  // Fetch histórico de re-entradas (lazy, só quando detalhes aberto e lead tem reentradas)
  useEffect(() => {
    setReentradas(null);
    if (aba !== "detalhes" || !lead.reentradas) return;
    fetch(`/api/crm/${clienteId}/leads/${lead.lead_id}/reentradas`)
      .then((r) => r.json())
      .then((d: { reentradas: Reentrada[] }) => setReentradas(d.reentradas ?? []))
      .catch(() => setReentradas([]));
  }, [aba, lead.lead_id, lead.reentradas, clienteId]);

  // Fetch histórico de etapas (lazy, ao abrir a aba Histórico)
  useEffect(() => {
    if (aba !== "historico") return;
    setHistoricoEventos(null);
    fetch(`/api/crm/${clienteId}/leads/${lead.lead_id}/historico`)
      .then((r) => r.json())
      .then((d: { eventos: EventoHistorico[]; lead: HistoricoLead | null }) => {
        setHistoricoEventos(d.eventos ?? []);
        setHistoricoLead(d.lead ?? null);
      })
      .catch(() => setHistoricoEventos([]));
  }, [aba, clienteId, lead.lead_id]);

  // Fecha dropdown de tag ao clicar fora
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (addTagRef.current && !addTagRef.current.contains(e.target as Node)) {
        setMostrarAddTag(false);
        setCriandoTag(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ─── Ações ─────────────────────────────────────────────────────────────────
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

  async function salvarDetalhes() {
    setSalvando(true);
    try {
      await fetch(`/api/crm/${clienteId}/leads/${lead.lead_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          observacoes: detalhes.observacoes || null,
          valor_negociacao: detalhes.valor_negociacao ?? null,
        }),
      });
      setSalvoOk(true);
      setTimeout(() => setSalvoOk(false), 2000);
    } finally { setSalvando(false); }
  }

  async function adicionarTag(tag: Tag) {
    await fetch(`/api/crm/${clienteId}/leads/${lead.lead_id}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagId: tag.id }),
    });
    setTagsLead((prev) => (prev.find((t) => t.id === tag.id) ? prev : [...prev, tag]));
    setMostrarAddTag(false);
  }

  async function removerTag(tagId: string) {
    await fetch(`/api/crm/${clienteId}/leads/${lead.lead_id}/tags`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagId }),
    });
    setTagsLead((prev) => prev.filter((t) => t.id !== tagId));
  }

  async function criarTag() {
    if (!novaTagNome.trim()) return;
    const res = await fetch(`/api/crm/${clienteId}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: novaTagNome.trim(), cor: novaTagCor }),
    });
    if (!res.ok) return;
    const { tag } = await res.json() as { tag: Tag };
    setTodasTags((prev) => [...prev.filter((t) => t.id !== tag.id), tag].sort((a, b) => a.nome.localeCompare(b.nome)));
    await adicionarTag(tag);
    setNovaTagNome("");
    setNovaTagCor(COR_OPCOES[0]);
    setCriandoTag(false);
  }

  const origem = origemLabel(lead);
  const tagsDisponiveis = todasTags.filter((t) => !tagsLead.find((lt) => lt.id === t.id));

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

      {/* Abas */}
      <div className="flex border-b border-neutral-100">
        {(["conversa", "detalhes", "origem", "historico"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setAba(tab)}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
              aba === tab
                ? "border-b-2 border-violet-600 text-violet-600"
                : "text-neutral-500 hover:text-neutral-700"
            }`}
          >
            {tab === "conversa" ? "Conversa"
              : tab === "detalhes" ? "Detalhes"
              : tab === "origem"   ? "Origem"
              : "Histórico"}
          </button>
        ))}
      </div>

      {/* ── Aba: Conversa ─────────────────────────────────────────────────── */}
      {aba === "conversa" && (
        <>
          <div ref={scrollContainer} className="flex-1 space-y-2 overflow-y-auto bg-neutral-50 px-4 py-3">
            {mensagens.length === 0 ? (
              <p className="py-8 text-center text-sm text-neutral-400">Nenhuma mensagem registrada</p>
            ) : (() => {
              const TZ = "America/Sao_Paulo";
              let lastDayKey = "";
              return mensagens.map((m) => {
                const dayKey = new Date(m.recebida_em).toLocaleDateString("pt-BR", {
                  timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
                });
                const showSep = dayKey !== lastDayKey;
                lastDayKey = dayKey;

                let dayLabel: string;
                const hoje     = new Date().toLocaleDateString("pt-BR", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
                const ontemD   = new Date(Date.now() - 86_400_000);
                const ontem    = ontemD.toLocaleDateString("pt-BR", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
                if (dayKey === hoje)   dayLabel = "Hoje";
                else if (dayKey === ontem) dayLabel = "Ontem";
                else {
                  const sameYear = new Date(m.recebida_em).getFullYear() === new Date().getFullYear();
                  dayLabel = new Date(m.recebida_em).toLocaleDateString("pt-BR", {
                    timeZone: TZ, day: "numeric", month: "long",
                    ...(sameYear ? {} : { year: "numeric" }),
                  });
                }

                return (
                  <div key={m.id}>
                    {showSep && (
                      <div className="flex items-center gap-2 py-2">
                        <div className="flex-1 border-t border-neutral-200" />
                        <span className="shrink-0 rounded-full bg-neutral-200 px-3 py-0.5 text-[11px] font-medium text-neutral-500">
                          {dayLabel}
                        </span>
                        <div className="flex-1 border-t border-neutral-200" />
                      </div>
                    )}
                    <MsgBubble
                      de={m.de}
                      tipo={m.tipo}
                      conteudo={m.conteudo}
                      mediaUrl={m.media_url}
                      recebidaEm={new Date(m.recebida_em)}
                    />
                  </div>
                );
              });
            })()}
            <div ref={bottomRef} />
          </div>
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
        </>
      )}

      {/* ── Aba: Detalhes ─────────────────────────────────────────────────── */}
      {aba === "detalhes" && (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {/* Data de entrada */}
          {lead.data_criacao && (
            <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2.5">
              <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">Data de entrada</p>
              <p className="mt-0.5 text-sm text-neutral-700">
                {(() => {
                  const d = new Date(lead.data_criacao!);
                  const local = new Date(d.getTime() + d.getTimezoneOffset() * 60 * 1000);
                  const data = local.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
                  if (lead.primeira_msg_em) {
                    const hora = new Date(lead.primeira_msg_em).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "America/Sao_Paulo",
                    });
                    return `${data}, às ${hora}`;
                  }
                  return data;
                })()}
              </p>
            </div>
          )}

          {/* Status conversão Meta CAPI */}
          {lead.capi_status && (
            <div className={`rounded-xl border px-3 py-2.5 ${
              lead.capi_status === "ok"
                ? "border-green-100 bg-green-50"
                : "border-red-100 bg-red-50"
            }`}>
              <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">
                Conversão Meta Ads
              </p>
              <div className="mt-1 flex items-center gap-2">
                <span className={`text-sm font-semibold ${lead.capi_status === "ok" ? "text-green-700" : "text-red-600"}`}>
                  {lead.capi_status === "ok" ? "✓ Enviada com sucesso" : "✗ Falhou no envio"}
                </span>
              </div>
              {lead.capi_enviado_em && (
                <p className="mt-0.5 text-[11px] text-neutral-400">
                  {new Date(lead.capi_enviado_em).toLocaleString("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                    day: "2-digit", month: "short", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </p>
              )}
            </div>
          )}

          {/* Valor da negociação */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-600">Valor da negociação</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">R$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={detalhes.valor_negociacao ?? ""}
                onChange={(e) => setDetalhes((d) => ({ ...d, valor_negociacao: e.target.value ? parseFloat(e.target.value) : null }))}
                placeholder="0,00"
                className="w-full rounded-xl border border-neutral-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10"
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-600">Tags</label>
            <div className="flex flex-wrap gap-1.5">
              {tagsLead.map((tag) => (
                <span
                  key={tag.id}
                  className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium text-white"
                  style={{ backgroundColor: tag.cor }}
                >
                  {tag.nome}
                  <button
                    onClick={() => removerTag(tag.id)}
                    className="ml-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white/25 hover:bg-white/40"
                  >
                    <svg className="h-2 w-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}

              {/* Botão adicionar tag */}
              <div className="relative" ref={addTagRef}>
                <button
                  onClick={() => { setMostrarAddTag((v) => !v); setCriandoTag(false); }}
                  className="flex items-center gap-1 rounded-full border border-dashed border-neutral-300 px-2.5 py-1 text-[11px] text-neutral-500 hover:border-neutral-400 hover:text-neutral-700"
                >
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" d="M12 5v14M5 12h14" />
                  </svg>
                  Adicionar
                </button>

                {mostrarAddTag && !criandoTag && (
                  <div className="absolute left-0 top-full z-50 mt-1 w-52 rounded-xl border border-neutral-200 bg-white shadow-lg">
                    {tagsDisponiveis.length > 0 && (
                      <div className="max-h-40 overflow-y-auto p-1">
                        {tagsDisponiveis.map((tag) => (
                          <button
                            key={tag.id}
                            onClick={() => adicionarTag(tag)}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs hover:bg-neutral-50"
                          >
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: tag.cor }} />
                            {tag.nome}
                          </button>
                        ))}
                      </div>
                    )}
                    {tagsDisponiveis.length > 0 && (
                      <div className="border-t border-neutral-100" />
                    )}
                    <div className="p-1">
                      <button
                        onClick={() => setCriandoTag(true)}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-violet-600 hover:bg-violet-50"
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" d="M12 5v14M5 12h14" />
                        </svg>
                        Nova tag
                      </button>
                    </div>
                  </div>
                )}

                {mostrarAddTag && criandoTag && (
                  <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-xl border border-neutral-200 bg-white p-3 shadow-lg">
                    <p className="mb-2 text-xs font-medium text-neutral-700">Nova tag</p>
                    <input
                      autoFocus
                      value={novaTagNome}
                      onChange={(e) => setNovaTagNome(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") criarTag(); }}
                      placeholder="Nome da tag"
                      className="mb-2 w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs outline-none focus:border-violet-500"
                    />
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {COR_OPCOES.map((cor) => (
                        <button
                          key={cor}
                          onClick={() => setNovaTagCor(cor)}
                          className={`h-5 w-5 rounded-full transition-transform ${novaTagCor === cor ? "scale-125 ring-2 ring-offset-1" : ""}`}
                          style={{ backgroundColor: cor }}
                        />
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setCriandoTag(false); }}
                        className="flex-1 rounded-lg border border-neutral-200 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={criarTag}
                        disabled={!novaTagNome.trim()}
                        className="flex-1 rounded-lg bg-violet-600 py-1.5 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-40"
                      >
                        Criar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-600">Observações</label>
            <textarea
              value={detalhes.observacoes ?? ""}
              onChange={(e) => setDetalhes((d) => ({ ...d, observacoes: e.target.value || null }))}
              rows={5}
              placeholder="Anotações sobre este lead…"
              className="w-full resize-none rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10"
            />
          </div>

          {/* Histórico de re-entradas */}
          {lead.reentradas > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                Histórico de retornos ({lead.reentradas})
              </p>
              {reentradas === null ? (
                <p className="text-xs text-neutral-400 animate-pulse">Carregando…</p>
              ) : (
                <div className="space-y-2">
                  {reentradas.map((r) => {
                    const dt = new Date(r.reentrada_em);
                    const data = dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
                    const hora = dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
                    const origem = (r.ad_id || r.ctwa_clid) ? "via Meta Ads" : "orgânico";
                    return (
                      <div key={r.id} className="rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2.5">
                        <p className="text-xs font-medium text-neutral-700">
                          Voltou de{" "}
                          <span className="text-violet-600">{r.fase_anterior}</span>
                        </p>
                        <p className="mt-0.5 text-[11px] text-neutral-400">
                          {data}, às {hora} · {origem}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <button
            onClick={salvarDetalhes}
            disabled={salvando}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {salvando ? "Salvando…" : salvoOk ? "Salvo!" : "Salvar"}
          </button>
        </div>
      )}

      {/* ── Aba: Origem ───────────────────────────────────────────────────── */}
      {aba === "origem" && (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {/* Canal */}
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Canal</p>
            <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${origemLabel(lead).cls}`}>
              {origemLabel(lead).label}
            </span>
          </div>

          {/* Meta Ads */}
          {(lead.ctwa_clid || lead.ad_id) && (
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Meta Ads</p>
              <dl className="space-y-3">

                {/* Plataforma onde o lead viu o anúncio */}
                {lead.source_app && (
                  <div>
                    <dt className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">Plataforma</dt>
                    <dd className="mt-0.5 text-sm text-neutral-800">
                      {lead.source_app === "instagram" ? "Instagram" : "Facebook"}
                    </dd>
                  </div>
                )}

                {/* Criativo do anúncio (vindo do webhook) */}
                {lead.ad_title && (
                  <div>
                    <dt className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">Título do anúncio</dt>
                    <dd className="mt-0.5 text-sm font-medium text-neutral-800">{lead.ad_title}</dd>
                  </div>
                )}
                {lead.ad_body && (
                  <div>
                    <dt className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">Texto do anúncio</dt>
                    <dd className="mt-0.5 text-sm text-neutral-700 leading-relaxed">{lead.ad_body}</dd>
                  </div>
                )}
                {lead.ad_media_url && (
                  <div>
                    <dt className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">Criativo</dt>
                    <dd className="mt-0.5">
                      <a
                        href={lead.ad_media_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-violet-600 underline hover:text-violet-800"
                      >
                        Ver no {lead.source_app === "instagram" ? "Instagram" : "Facebook"} ↗
                      </a>
                    </dd>
                  </div>
                )}

                {/* Hierarquia da campanha — DB primeiro, API como fallback para leads antigos */}
                {lead.ad_id && !lead.campaign_name && metaAdInfo === "loading" && (
                  <div className="text-xs text-neutral-400 animate-pulse">Buscando dados do anúncio…</div>
                )}
                {(lead.campaign_name ?? (metaAdInfo !== "loading" && metaAdInfo !== "error" && metaAdInfo !== null ? metaAdInfo.campanhaNome : null)) && (
                  <div>
                    <dt className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">Campanha</dt>
                    <dd className="mt-0.5 text-sm text-neutral-800">
                      {lead.campaign_name ?? (metaAdInfo !== "loading" && metaAdInfo !== "error" && metaAdInfo !== null ? metaAdInfo.campanhaNome : null)}
                    </dd>
                  </div>
                )}
                {(lead.adset_name ?? (metaAdInfo !== "loading" && metaAdInfo !== "error" && metaAdInfo !== null ? metaAdInfo.adSetNome : null)) && (
                  <div>
                    <dt className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">Conjunto de anúncios</dt>
                    <dd className="mt-0.5 text-sm text-neutral-800">
                      {lead.adset_name ?? (metaAdInfo !== "loading" && metaAdInfo !== "error" && metaAdInfo !== null ? metaAdInfo.adSetNome : null)}
                    </dd>
                  </div>
                )}
                {(lead.ad_name ?? (metaAdInfo !== "loading" && metaAdInfo !== "error" && metaAdInfo !== null ? metaAdInfo.adNome : null)) && (
                  <div>
                    <dt className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">Nome do anúncio</dt>
                    <dd className="mt-0.5 text-sm text-neutral-800">
                      {lead.ad_name ?? (metaAdInfo !== "loading" && metaAdInfo !== "error" && metaAdInfo !== null ? metaAdInfo.adNome : null)}
                    </dd>
                  </div>
                )}

                {/* IDs brutos */}
                {lead.ad_id && (
                  <div>
                    <dt className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">Ad ID</dt>
                    <dd className="mt-0.5 break-all text-xs text-neutral-500">{lead.ad_id}</dd>
                  </div>
                )}
                {lead.ctwa_clid && (
                  <div>
                    <dt className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">CTWA Click ID</dt>
                    <dd className="mt-0.5 break-all text-xs text-neutral-500">{lead.ctwa_clid}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {/* Google Ads */}
          {(atribuicao?.gclid || atribuicao?.utm_campaign) && (
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Google Ads</p>
              <dl className="space-y-3">
                {[
                  { label: "Campanha", value: atribuicao?.utm_campaign },
                  { label: "Conjunto (utm_medium)", value: atribuicao?.utm_medium },
                  { label: "Termo", value: atribuicao?.utm_term },
                  { label: "Conteúdo", value: atribuicao?.utm_content },
                  { label: "GCLID", value: atribuicao?.gclid },
                ].map(({ label, value }) =>
                  value ? (
                    <div key={label}>
                      <dt className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">{label}</dt>
                      <dd className="mt-0.5 break-all text-sm text-neutral-800">{value}</dd>
                    </div>
                  ) : null
                )}
              </dl>
            </div>
          )}

          {/* UTMs gerais (Site / outros) */}
          {!lead.gclid && !lead.ctwa_clid && !lead.ad_id && atribuicao?.utm_source && (
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Rastreamento</p>
              <dl className="space-y-3">
                {[
                  { label: "Fonte (utm_source)", value: atribuicao?.utm_source },
                  { label: "Mídia (utm_medium)", value: atribuicao?.utm_medium },
                  { label: "Campanha", value: atribuicao?.utm_campaign },
                  { label: "Conteúdo", value: atribuicao?.utm_content },
                  { label: "Termo", value: atribuicao?.utm_term },
                ].map(({ label, value }) =>
                  value ? (
                    <div key={label}>
                      <dt className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">{label}</dt>
                      <dd className="mt-0.5 break-all text-sm text-neutral-800">{value}</dd>
                    </div>
                  ) : null
                )}
              </dl>
            </div>
          )}

          {/* Orgânico — sem nenhuma atribuição */}
          {!lead.gclid && !lead.ctwa_clid && !lead.ad_id && !atribuicao?.utm_source && (
            <p className="text-sm text-neutral-400">Nenhuma atribuição registrada — lead orgânico (WhatsApp direto).</p>
          )}
        </div>
      )}

      {/* ── Aba: Histórico ────────────────────────────────────────────── */}
      {aba === "historico" && (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {historicoEventos === null ? (
            <p className="py-8 text-center text-sm text-neutral-400 animate-pulse">Carregando…</p>
          ) : historicoEventos.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-400">
              Nenhum histórico registrado ainda.
            </p>
          ) : (
            <ol className="relative border-l border-neutral-200 space-y-6 ml-3">
              {historicoEventos.map((ev, idx) => {
                const isLast   = idx === historicoEventos.length - 1;
                const entrou   = new Date(ev.entrou_em);
                const saiu     = ev.saiu_em ? new Date(ev.saiu_em) : null;
                const dtEntrou = entrou.toLocaleDateString("pt-BR", {
                  day: "2-digit", month: "short", year: "numeric",
                  timeZone: "America/Sao_Paulo",
                });
                const hrEntrou = entrou.toLocaleTimeString("pt-BR", {
                  hour: "2-digit", minute: "2-digit",
                  timeZone: "America/Sao_Paulo",
                });

                // Duração na etapa
                const durMs   = saiu ? saiu.getTime() - entrou.getTime() : Date.now() - entrou.getTime();
                const durDias = Math.round(durMs / 86_400_000);
                const durStr  = durDias === 0 ? "menos de 1 dia"
                  : durDias === 1 ? "1 dia"
                  : `${durDias} dias`;

                const isEntrada   = ev.tipo === "entrada";
                const isReentrada = ev.tipo === "reentrada";
                const highlight   = isEntrada || isReentrada;

                // Cor e ícone do ponto na linha do tempo
                const dotCls = highlight
                  ? "bg-violet-600 ring-2 ring-violet-200"
                  : "bg-neutral-300";

                return (
                  <li key={ev.id} className="ml-6">
                    {/* Ponto */}
                    <span className={`absolute -left-[7px] flex h-3.5 w-3.5 items-center justify-center rounded-full ${dotCls}`} />

                    <div className={`rounded-xl border px-3 py-2.5 ${highlight ? "border-violet-100 bg-violet-50" : "border-neutral-100 bg-neutral-50"}`}>
                      {/* Tipo + etapa */}
                      <p className="text-xs font-semibold text-neutral-800">
                        {isEntrada   ? "Entrada inicial"
                          : isReentrada ? "Re-entrada"
                          : ev.etapa}
                      </p>
                      {(isEntrada || isReentrada) && (
                        <p className="text-[11px] text-neutral-500">
                          Fase: <span className="font-medium text-neutral-700">{ev.etapa}</span>
                        </p>
                      )}
                      {isReentrada && ev.fase_anterior && (
                        <p className="text-[11px] text-neutral-400">
                          Vinha de: <span className="font-medium">{ev.fase_anterior}</span>
                        </p>
                      )}

                      {/* Origem (para entrada e reentrada) */}
                      {(isEntrada || isReentrada) && ev.origem && (
                        <p className="mt-1 text-[11px]">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold
                            ${ev.origem === "Meta Ads"   ? "bg-blue-100 text-blue-700"
                            : ev.origem === "Google Ads" ? "bg-green-100 text-green-700"
                            : "bg-neutral-200 text-neutral-600"}`}>
                            {ev.origem}
                          </span>
                          {/* Título do anúncio (se primeiro evento e tivermos os dados) */}
                          {isEntrada && historicoLead?.ad_title && (
                            <span className="ml-1.5 text-neutral-500">{historicoLead.ad_title}</span>
                          )}
                          {/* Campanha */}
                          {isEntrada && historicoLead?.campaign_name && (
                            <span className="ml-1.5 text-neutral-400">· {historicoLead.campaign_name}</span>
                          )}
                        </p>
                      )}

                      {/* Data + duração */}
                      <p className="mt-1.5 text-[10px] text-neutral-400">
                        {dtEntrou} às {hrEntrou}
                        {!isLast && saiu && (
                          <span className="ml-2 text-neutral-300">· ficou {durStr}</span>
                        )}
                        {isLast && (
                          <span className="ml-2 text-violet-400">· etapa atual ({durStr})</span>
                        )}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
