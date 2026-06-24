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
  if (lead.gclid) return { label: "Google Ads", cls: "bg-blue-50 text-blue-600" };
  if (lead.source_app === "instagram") return { label: "Instagram", cls: "bg-pink-50 text-pink-600" };
  if (lead.source_app === "facebook" || lead.ad_id || lead.ctwa_clid)
    return { label: "Facebook", cls: "bg-blue-50 text-blue-500" };
  if (lead.utm_source === "site") return { label: "Site", cls: "bg-emerald-50 text-emerald-600" };
  return { label: "Orgânico", cls: "bg-neutral-100 text-neutral-500" };
}

const COR_OPCOES = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#3b82f6", "#6b7280",
];

export function ConversaPanel({ clienteId, lead, etapas, onClose, onFaseChange, onDelete }: Props) {
  const [aba, setAba] = useState<"conversa" | "detalhes" | "origem">("conversa");

  // Conversa
  const [mensagens, setMensagens] = useState<MensagemCrm[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

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
    fetchMensagens();
    const iv = setInterval(fetchMensagens, 8000);
    return () => clearInterval(iv);
  }, [fetchMensagens]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
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
    if (aba === "origem" && lead.ad_id && metaAdInfo === null) {
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
        {(["conversa", "detalhes", "origem"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setAba(tab)}
            className={`flex-1 py-2.5 text-xs font-medium capitalize transition-colors ${
              aba === tab
                ? "border-b-2 border-violet-600 text-violet-600"
                : "text-neutral-500 hover:text-neutral-700"
            }`}
          >
            {tab === "conversa" ? "Conversa" : tab === "detalhes" ? "Detalhes" : "Origem"}
          </button>
        ))}
      </div>

      {/* ── Aba: Conversa ─────────────────────────────────────────────────── */}
      {aba === "conversa" && (
        <>
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
                {new Date(lead.data_criacao).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
              </p>
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
                          style={{ backgroundColor: cor, outlineColor: cor }}
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

          {/* Meta Ads (Facebook / Instagram) */}
          {(lead.ctwa_clid || lead.ad_id || lead.source_app === "facebook" || lead.source_app === "instagram") && (
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Meta Ads</p>
              <dl className="space-y-3">
                {/* Plataforma */}
                <div>
                  <dt className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">Plataforma</dt>
                  <dd className="mt-0.5 text-sm text-neutral-800">
                    {lead.source_app === "instagram" ? "Instagram" : "Facebook"}
                  </dd>
                </div>

                {/* Dados enriquecidos do anúncio via Graph API */}
                {lead.ad_id && metaAdInfo === "loading" && (
                  <div className="text-xs text-neutral-400 animate-pulse">Buscando dados do anúncio…</div>
                )}
                {lead.ad_id && metaAdInfo !== "loading" && metaAdInfo !== "error" && metaAdInfo !== null && (
                  <>
                    {metaAdInfo.campanhaNome && (
                      <div>
                        <dt className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">Campanha</dt>
                        <dd className="mt-0.5 text-sm text-neutral-800">{metaAdInfo.campanhaNome}</dd>
                      </div>
                    )}
                    {metaAdInfo.adSetNome && (
                      <div>
                        <dt className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">Conjunto de anúncios</dt>
                        <dd className="mt-0.5 text-sm text-neutral-800">{metaAdInfo.adSetNome}</dd>
                      </div>
                    )}
                    {metaAdInfo.adNome && (
                      <div>
                        <dt className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">Anúncio</dt>
                        <dd className="mt-0.5 text-sm text-neutral-800">{metaAdInfo.adNome}</dd>
                      </div>
                    )}
                  </>
                )}
                {lead.ad_id && metaAdInfo === "error" && (
                  <div className="text-xs text-red-400">Não foi possível carregar os dados do anúncio.</div>
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
    </div>
  );
}
