"use client";

import { useEffect, useState } from "react";
import { TarefaDetalhe, PRIO, type Tarefa, type StatusKey, type PrioKey } from "@/components/tarefas/tarefa-detalhe";

type Cliente = { id: number; nome: string };

type DashTarefa = Tarefa & {
  cliente_nome: string | null;
  projeto_nome: string | null;
};

const STATUS_OPTS: { value: string; label: string }[] = [
  { value: "",            label: "Todos os status" },
  { value: "a_fazer",     label: "A Fazer" },
  { value: "em_andamento",label: "Em Andamento" },
  { value: "em_revisao",  label: "Em Revisão" },
  { value: "concluido",   label: "Concluído" },
];

const STATUS_DOT: Record<string, string> = {
  a_fazer:      "bg-neutral-400",
  em_andamento: "bg-blue-500",
  em_revisao:   "bg-amber-500",
  concluido:    "bg-emerald-500",
};
const STATUS_LABEL: Record<string, string> = {
  a_fazer: "A Fazer", em_andamento: "Em Andamento",
  em_revisao: "Em Revisão", concluido: "Concluído",
};

function fmtDate(dl: string | null) {
  if (!dl) return null;
  const [y, m, d] = dl.split("-");
  return `${d}/${m}/${y}`;
}
function isOverdue(dl: string | null) {
  if (!dl) return false;
  return new Date(dl + "T23:59:59") < new Date();
}

export function DashboardView({ clientes }: { clientes: Cliente[] }) {
  const [tarefas, setTarefas]   = useState<DashTarefa[] | null>(null);
  const [detalhe, setDetalhe]   = useState<DashTarefa | null>(null);
  const [responsaveis, setResp] = useState<{ admins: {nome:string}[]; clientes: {nome:string}[] }>({ admins: [], clientes: [] });

  const [filtroStatus,     setFiltroStatus]     = useState("");
  const [filtroResponsavel,setFiltroResponsavel] = useState("");
  const [filtroClienteId,  setFiltroClienteId]  = useState("");

  // Carrega responsáveis uma vez
  useEffect(() => {
    fetch("/api/tarefas/responsaveis")
      .then((r) => r.json())
      .then(setResp)
      .catch(() => {});
  }, []);

  // Recarrega tarefas quando filtros mudam
  useEffect(() => {
    setTarefas(null);
    const p = new URLSearchParams();
    if (filtroStatus)      p.set("status",      filtroStatus);
    if (filtroResponsavel) p.set("responsavel",  filtroResponsavel);
    if (filtroClienteId)   p.set("clienteId",    filtroClienteId);
    fetch(`/api/tarefas/dashboard?${p}`)
      .then((r) => r.json())
      .then((d: DashTarefa[]) => setTarefas(d))
      .catch(() => setTarefas([]));
  }, [filtroStatus, filtroResponsavel, filtroClienteId]);

  function handleUpdate(t: Tarefa) {
    setTarefas((prev) => prev?.map((x) => x.id === t.id ? { ...x, ...t } : x) ?? null);
    setDetalhe((prev) => prev ? { ...prev, ...t } : null);
  }

  function handleDelete(id: number) {
    setTarefas((prev) => prev?.filter((x) => x.id !== id) ?? null);
    setDetalhe(null);
  }

  const semConcluidas  = tarefas?.filter((t) => t.status !== "concluido") ?? [];
  const comConcluidas  = tarefas?.filter((t) => t.status === "concluido") ?? [];

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* ── Lista ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Filtros */}
        <div className="flex flex-wrap gap-2 border-b border-neutral-200 bg-white px-6 py-3">
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm outline-none focus:border-violet-400"
          >
            {STATUS_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          <select
            value={filtroResponsavel}
            onChange={(e) => setFiltroResponsavel(e.target.value)}
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm outline-none focus:border-violet-400"
          >
            <option value="">Todos os responsáveis</option>
            {responsaveis.admins.length > 0 && (
              <optgroup label="Equipe">
                {responsaveis.admins.map((a) => <option key={a.nome} value={a.nome}>{a.nome}</option>)}
              </optgroup>
            )}
            {responsaveis.clientes.length > 0 && (
              <optgroup label="Clientes">
                {responsaveis.clientes.map((c) => <option key={c.nome} value={c.nome}>{c.nome}</option>)}
              </optgroup>
            )}
          </select>

          <select
            value={filtroClienteId}
            onChange={(e) => setFiltroClienteId(e.target.value)}
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm outline-none focus:border-violet-400"
          >
            <option value="">Todos os clientes</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>

          {(filtroStatus || filtroResponsavel || filtroClienteId) && (
            <button
              onClick={() => { setFiltroStatus(""); setFiltroResponsavel(""); setFiltroClienteId(""); }}
              className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs text-neutral-500 hover:bg-neutral-50"
            >
              Limpar filtros
            </button>
          )}

          <span className="ml-auto self-center text-xs text-neutral-400">
            {tarefas === null ? "Carregando…" : `${tarefas.length} tarefa${tarefas.length !== 1 ? "s" : ""}`}
          </span>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {tarefas === null ? (
            <p className="py-12 text-center text-sm text-neutral-400 animate-pulse">Carregando tarefas…</p>
          ) : tarefas.length === 0 ? (
            <p className="py-12 text-center text-sm text-neutral-400">Nenhuma tarefa encontrada.</p>
          ) : (
            <div className="space-y-1.5">
              {/* Ativas primeiro */}
              {semConcluidas.map((t) => <TarefaRow key={t.id} t={t} onClick={() => setDetalhe(t)} />)}

              {/* Concluídas dobráveis */}
              {comConcluidas.length > 0 && (
                <ConcluídasGroup items={comConcluidas} onSelect={(t) => setDetalhe(t)} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Painel de detalhe ── */}
      {detalhe && (
        <TarefaDetalhe
          tarefa={detalhe}
          onClose={() => setDetalhe(null)}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

// ── Linha de tarefa ───────────────────────────────────────────────────────────
function TarefaRow({ t, onClick }: { t: DashTarefa; onClick: () => void }) {
  const done     = t.microtarefas.filter((m) => m.concluida).length;
  const total    = t.microtarefas.length;
  const overdue  = isOverdue(t.data_limite) && t.status !== "concluido";
  const concluido = t.status === "concluido";

  return (
    <div
      onClick={onClick}
      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition
        hover:border-violet-200 hover:shadow-sm
        ${concluido ? "border-neutral-100 bg-neutral-50 opacity-70" : "border-neutral-200 bg-white"}`}
    >
      {/* Status dot */}
      <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[t.status] ?? "bg-neutral-300"}`} />

      {/* Título */}
      <p className={`flex-1 min-w-0 truncate text-sm font-medium ${concluido ? "line-through text-neutral-400" : "text-neutral-800"}`}>
        {t.titulo}
      </p>

      {/* Meta chips */}
      <div className="hidden sm:flex items-center gap-2 shrink-0">
        {t.cliente_nome && (
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600 max-w-[120px] truncate">
            {t.cliente_nome}
          </span>
        )}
        {t.projeto_nome && (
          <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700 max-w-[120px] truncate">
            {t.projeto_nome}
          </span>
        )}
        {t.lead_nome && (
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 max-w-[100px] truncate">
            {t.lead_nome}
          </span>
        )}
      </div>

      {/* Prioridade */}
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${PRIO[t.prioridade as PrioKey]?.cls ?? "bg-neutral-100 text-neutral-500"}`}>
        {PRIO[t.prioridade as PrioKey]?.label ?? t.prioridade}
      </span>

      {/* Responsável */}
      {t.responsavel && (
        <span className="hidden lg:block shrink-0 text-xs text-neutral-400 max-w-[100px] truncate">
          {t.responsavel}
        </span>
      )}

      {/* Prazo */}
      {t.data_limite && (
        <span className={`shrink-0 text-xs font-medium ${overdue ? "text-red-500" : "text-neutral-400"}`}>
          {fmtDate(t.data_limite)}
        </span>
      )}

      {/* Sub-tarefas */}
      {total > 0 && (
        <span className="shrink-0 text-[11px] text-neutral-400">{done}/{total}</span>
      )}
    </div>
  );
}

// ── Grupo de concluídas (colapsável) ─────────────────────────────────────────
function ConcluídasGroup({ items, onSelect }: { items: DashTarefa[]; onSelect: (t: DashTarefa) => void }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="mt-4">
      <button
        onClick={() => setAberto((v) => !v)}
        className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-400 hover:text-neutral-600 mb-2"
      >
        <svg className={`h-3.5 w-3.5 transition-transform ${aberto ? "rotate-90" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        Concluídas · {items.length}
      </button>
      {aberto && (
        <div className="space-y-1.5">
          {items.map((t) => <TarefaRow key={t.id} t={t} onClick={() => onSelect(t)} />)}
        </div>
      )}
    </div>
  );
}
