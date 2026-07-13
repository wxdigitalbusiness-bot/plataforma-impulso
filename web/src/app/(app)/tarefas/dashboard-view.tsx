"use client";

import { useEffect, useState } from "react";
import { TarefaDetalhe, PRIO, type Tarefa, type PrioKey } from "@/components/tarefas/tarefa-detalhe";

type Cliente = { id: number; nome: string };

type DashTarefa = Tarefa & {
  cliente_nome: string | null;
  projeto_nome: string | null;
};

const STATUS_OPTS = [
  { value: "",             label: "Todos os status" },
  { value: "a_fazer",      label: "A Fazer" },
  { value: "em_andamento", label: "Em Andamento" },
  { value: "em_revisao",   label: "Em Revisão" },
  { value: "concluido",    label: "Concluído" },
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

// ── Eisenhower helpers ────────────────────────────────────────────────────────

function daysUntil(dl: string | null): number | null {
  if (!dl) return null;
  const diff = new Date(dl + "T23:59:59").getTime() - Date.now();
  return Math.ceil(diff / 86_400_000);
}

function isUrgent(t: DashTarefa): boolean {
  if (t.prioridade === "urgente") return true;
  const d = daysUntil(t.data_limite);
  return d !== null && d <= 3;
}

function isImportant(t: DashTarefa): boolean {
  return t.prioridade === "urgente" || t.prioridade === "alta";
}

function fmtDate(dl: string | null) {
  if (!dl) return null;
  const [y, m, d] = dl.split("-");
  return `${d}/${m}/${y}`;
}

// ── Quadrant config ───────────────────────────────────────────────────────────

const QUADRANTS = [
  {
    key: "q1",
    urgente: true, importante: true,
    label: "Fazer agora",
    sub: "Urgente · Importante",
    border: "border-red-200",
    hdr: "bg-red-50 text-red-700",
    dot: "bg-red-500",
    badge: "bg-red-100 text-red-700",
  },
  {
    key: "q2",
    urgente: false, importante: true,
    label: "Planejar",
    sub: "Importante · Não urgente",
    border: "border-amber-200",
    hdr: "bg-amber-50 text-amber-700",
    dot: "bg-amber-500",
    badge: "bg-amber-100 text-amber-700",
  },
  {
    key: "q3",
    urgente: true, importante: false,
    label: "Delegar",
    sub: "Urgente · Menos importante",
    border: "border-blue-200",
    hdr: "bg-blue-50 text-blue-700",
    dot: "bg-blue-500",
    badge: "bg-blue-100 text-blue-700",
  },
  {
    key: "q4",
    urgente: false, importante: false,
    label: "Eliminar",
    sub: "Não urgente · Menos importante",
    border: "border-neutral-200",
    hdr: "bg-neutral-100 text-neutral-500",
    dot: "bg-neutral-400",
    badge: "bg-neutral-100 text-neutral-500",
  },
] as const;

type Responsaveis = { admins: { nome: string }[]; clientes: { nome: string }[] };

// ── Main component ────────────────────────────────────────────────────────────

export function DashboardView({ clientes, responsaveis = { admins: [], clientes: [] } }: { clientes: Cliente[]; responsaveis?: Responsaveis }) {
  const [tarefas, setTarefas]   = useState<DashTarefa[] | null>(null);
  const [detalhe, setDetalhe]   = useState<DashTarefa | null>(null);

  const [filtroStatus,      setFiltroStatus]      = useState("");
  const [filtroResponsavel, setFiltroResponsavel] = useState("");
  const [filtroClienteId,   setFiltroClienteId]   = useState("");

  useEffect(() => {
    setTarefas(null);
    const p = new URLSearchParams();
    if (filtroStatus)      p.set("status",     filtroStatus);
    if (filtroResponsavel) p.set("responsavel", filtroResponsavel);
    if (filtroClienteId)   p.set("clienteId",   filtroClienteId);
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

  const hasFilter = !!(filtroStatus || filtroResponsavel || filtroClienteId);

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* ── Área principal ── */}
      <div className="flex flex-1 flex-col overflow-hidden">

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 bg-white px-6 py-3">
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

          {hasFilter && (
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

        {/* Legenda de urgência */}
        <div className="flex items-center gap-4 border-b border-neutral-100 bg-neutral-50 px-6 py-2 text-[11px] text-neutral-400">
          <span className="font-semibold uppercase tracking-wide">Urgência</span>
          <span>• Prioridade <strong className="text-red-500">urgente</strong></span>
          <span>• Prazo vencido ou nos próximos 3 dias</span>
        </div>

        {/* Matriz 2×2 */}
        {tarefas === null ? (
          <p className="py-12 text-center text-sm text-neutral-400 animate-pulse">Carregando tarefas…</p>
        ) : (
          <div className="grid flex-1 grid-cols-2 grid-rows-2 gap-px bg-neutral-200 overflow-hidden">
            {QUADRANTS.map((q) => {
              const items = tarefas.filter((t) =>
                isUrgent(t) === q.urgente && isImportant(t) === q.importante
              );
              return (
                <Quadrant
                  key={q.key}
                  config={q}
                  items={items}
                  onSelect={(t) => setDetalhe(t)}
                  selectedId={detalhe?.id ?? null}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* ── Painel de detalhe ── */}
      {detalhe && (
        <TarefaDetalhe
          tarefa={detalhe}
          responsaveis={responsaveis}
          onClose={() => setDetalhe(null)}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

// ── Quadrante ─────────────────────────────────────────────────────────────────

type QConfig = typeof QUADRANTS[number];

function Quadrant({
  config: q, items, onSelect, selectedId,
}: {
  config: QConfig;
  items: DashTarefa[];
  onSelect: (t: DashTarefa) => void;
  selectedId: number | null;
}) {
  return (
    <div className={`flex flex-col bg-white overflow-hidden border-0`}>
      {/* Header */}
      <div className={`flex items-center gap-2 px-4 py-2.5 ${q.hdr} shrink-0`}>
        <span className={`h-2 w-2 rounded-full ${q.dot} shrink-0`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">{q.label}</p>
          <p className="text-[11px] opacity-70 leading-tight">{q.sub}</p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${q.badge}`}>
          {items.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
        {items.length === 0 ? (
          <p className="py-6 text-center text-xs text-neutral-300">Nenhuma tarefa</p>
        ) : (
          items.map((t) => (
            <MatrizCard
              key={t.id}
              t={t}
              selected={t.id === selectedId}
              onClick={() => onSelect(t)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── Card compacto ─────────────────────────────────────────────────────────────

function MatrizCard({ t, selected, onClick }: { t: DashTarefa; selected: boolean; onClick: () => void }) {
  const days    = daysUntil(t.data_limite);
  const overdue = days !== null && days < 0;
  const soon    = days !== null && days >= 0 && days <= 3;
  const concluido = t.status === "concluido";

  return (
    <div
      onClick={onClick}
      className={`cursor-pointer rounded-lg border px-3 py-2 transition
        ${selected
          ? "border-violet-400 bg-violet-50 shadow-sm"
          : "border-neutral-100 bg-white hover:border-neutral-300 hover:shadow-sm"
        }
        ${concluido ? "opacity-50" : ""}
      `}
    >
      {/* Título */}
      <p className={`text-sm font-medium leading-snug mb-1.5
        ${concluido ? "line-through text-neutral-400" : "text-neutral-800"}`}>
        {t.titulo}
      </p>

      {/* Chips */}
      <div className="flex flex-wrap items-center gap-1">
        {/* Status */}
        <span className="flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-500">
          <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[t.status]}`} />
          {STATUS_LABEL[t.status]}
        </span>

        {/* Prazo */}
        {t.data_limite && (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold
            ${overdue ? "bg-red-100 text-red-600"
            : soon    ? "bg-amber-100 text-amber-600"
                      : "bg-neutral-100 text-neutral-500"}`}
          >
            {overdue ? "⚠ " : ""}{fmtDate(t.data_limite)}
            {days !== null && days >= 0 && days <= 7 && ` · ${days}d`}
          </span>
        )}

        {/* Cliente */}
        {t.cliente_nome && (
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-500 max-w-[90px] truncate">
            {t.cliente_nome}
          </span>
        )}

        {/* Lead */}
        {t.lead_nome && (
          <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] text-violet-600 max-w-[90px] truncate">
            {t.lead_nome}
          </span>
        )}

        {/* Sub-tarefas */}
        {t.microtarefas.length > 0 && (
          <span className="ml-auto text-[10px] text-neutral-400">
            {t.microtarefas.filter((m) => m.concluida).length}/{t.microtarefas.length}
          </span>
        )}
      </div>
    </div>
  );
}
