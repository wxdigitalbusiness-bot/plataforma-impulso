"use client";

import { useEffect, useState } from "react";
import { TarefaDetalhe, PRIO, type Tarefa, type StatusKey, type PrioKey, type Projeto } from "@/components/tarefas/tarefa-detalhe";
import { DashboardView } from "./dashboard-view";

// ── Types ──────────────────────────────────────────────────────────────────────
type Cliente     = { id: number; nome: string };
type Responsaveis = { admins: { nome: string }[]; clientes: { nome: string }[] };

// ── Config ─────────────────────────────────────────────────────────────────────
const COLUNAS: { id: StatusKey; label: string; hdr: string; dot: string }[] = [
  { id: "a_fazer",             label: "A Fazer",             hdr: "bg-neutral-100 text-neutral-700", dot: "bg-neutral-400" },
  { id: "em_andamento",        label: "Em Andamento",        hdr: "bg-blue-50 text-blue-700",       dot: "bg-blue-500" },
  { id: "aguardando_resposta", label: "Aguardando Resposta", hdr: "bg-orange-50 text-orange-700",   dot: "bg-orange-400" },
  { id: "em_revisao",          label: "Em Revisão",          hdr: "bg-amber-50 text-amber-700",     dot: "bg-amber-500" },
  { id: "concluido",           label: "Concluído",           hdr: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
];

const STATUS_BORDER: Record<StatusKey, string> = {
  a_fazer:             "border-l-neutral-300",
  em_andamento:        "border-l-blue-400",
  aguardando_resposta: "border-l-orange-400",
  em_revisao:          "border-l-amber-500",
  concluido:           "border-l-emerald-400",
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function isOverdue(dl: string | null) {
  if (!dl) return false;
  return new Date(dl + "T23:59:59") < new Date();
}
function fmtDate(dl: string | null) {
  if (!dl) return null;
  const [y, m, d] = dl.split("-");
  return `${d}/${m}/${y}`;
}

// ── Ícones ─────────────────────────────────────────────────────────────────────
function Ico({ d, className = "h-4 w-4" }: { d: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}
const ICONS = {
  x:        "M6 18L18 6M6 6l12 12",
  plus:     "M12 4v16m8-8H4",
  check:    "M5 13l4 4L19 7",
  trash:    "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16",
  cal:      "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  folder:   "M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z",
  chevDown: "M19 9l-7 7-7-7",
  chevUp:   "M5 15l7-7 7 7",
  link:     "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1",
};

// ── TarefaCard ─────────────────────────────────────────────────────────────────
function TarefaCard({
  tarefa, onClick, onDragStart, onDragEnd, isDragging,
  expanded, onToggleExpand, onToggleMicro, compact = false,
  projetoNome, projetoCor,
}: {
  tarefa: Tarefa;
  onClick: () => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
  onToggleMicro?: (microId: number, concluida: boolean) => void;
  compact?: boolean;
  projetoNome?: string;
  projetoCor?: string;
}) {
  const done      = tarefa.microtarefas.filter((m) => m.concluida).length;
  const total     = tarefa.microtarefas.length;
  const overdue   = isOverdue(tarefa.data_limite);
  const concluido = tarefa.status === "concluido";

  return (
    <div
      draggable
      onDragStart={(e) => { e.stopPropagation(); onDragStart?.(); }}
      onDragEnd={onDragEnd}
      className={
        compact
          ? `bg-white border-b border-violet-50 border-l-[3px] ${STATUS_BORDER[tarefa.status]} px-3 py-2 last:border-0 cursor-grab active:cursor-grabbing transition-opacity ${isDragging ? "opacity-40" : ""}`
          : `cursor-grab active:cursor-grabbing rounded-xl border bg-white p-3 shadow-sm hover:border-neutral-300 hover:shadow transition-all space-y-2
             ${isDragging ? "opacity-40 scale-95" : ""}
             ${concluido ? "border-emerald-200" : "border-neutral-200"}`
      }
      style={!compact && projetoCor ? { borderLeftWidth: "3px", borderLeftColor: projetoCor } : undefined}
    >
      {/* Title row */}
      <div className="flex items-start gap-1.5">
        {concluido && !compact && (
          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100">
            <Ico d={ICONS.check} className="h-2.5 w-2.5 text-emerald-600" />
          </span>
        )}
        <p
          className={`flex-1 text-sm font-medium leading-snug cursor-pointer
            ${concluido ? "line-through text-neutral-400" : "text-neutral-900"}`}
          onClick={(e) => { e.stopPropagation(); onClick(); }}
        >
          {tarefa.titulo}
        </p>
        {total > 0 && onToggleExpand && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
            className="shrink-0 rounded p-0.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition"
          >
            <Ico d={expanded ? ICONS.chevUp : ICONS.chevDown} className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Badges + meta (non-compact only) */}
      {!compact && (
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${PRIO[tarefa.prioridade].cls}`}>
              {PRIO[tarefa.prioridade].label}
            </span>
            {tarefa.visivel_portal && (
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-700">Portal</span>
            )}
            {projetoNome && (
              <span className="flex items-center gap-1 rounded-full bg-violet-50 border border-violet-100 px-2 py-0.5 text-[11px] text-violet-600 max-w-[120px] truncate">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: projetoCor }} />
                {projetoNome}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between text-[11px] text-neutral-400">
            {tarefa.data_limite ? (
              <span className={`flex items-center gap-1 ${overdue ? "text-red-500 font-medium" : ""}`}>
                <Ico d={ICONS.cal} className="h-3 w-3" />
                {fmtDate(tarefa.data_limite)}
              </span>
            ) : <span />}
            {total > 0 && !expanded && (
              <span className="flex items-center gap-1">
                <Ico d={ICONS.check} className="h-3 w-3" />
                {done}/{total}
              </span>
            )}
          </div>
          {!expanded && total > 0 && (
            <div className="h-1 w-full rounded-full bg-neutral-100 overflow-hidden">
              <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${Math.round((done / total) * 100)}%` }} />
            </div>
          )}
        </>
      )}

      {/* Microtarefas checklist (when expanded) */}
      {expanded && total > 0 && (
        <div className={`space-y-1.5 ${compact ? "mt-1.5" : "mt-2 border-t border-neutral-100 pt-2"}`}>
          {tarefa.microtarefas.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-2 cursor-pointer"
              onClick={(e) => { e.stopPropagation(); onToggleMicro?.(m.id, !m.concluida); }}
            >
              <div className={`h-3.5 w-3.5 shrink-0 rounded border flex items-center justify-center transition
                ${m.concluida ? "border-emerald-500 bg-emerald-500" : "border-neutral-300"}`}>
                {m.concluida && <Ico d={ICONS.check} className="h-2.5 w-2.5 text-white" />}
              </div>
              <span className={`text-xs ${m.concluida ? "line-through text-neutral-400" : "text-neutral-600"}`}>
                {m.texto}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── ProjetoCard ────────────────────────────────────────────────────────────────
function ProjetoCard({
  projeto, tasks, expanded, onToggle, onOpenDetail, onAddTask,
  draggingId, onDragStart, onDragEnd,
  isDragging, onProjDragStart, onProjDragEnd,
  expandedTasks, onToggleTask, onToggleMicro, onTaskClick, onTaskStatusChange,
}: {
  projeto: Projeto;
  tasks: Tarefa[];
  expanded: boolean;
  onToggle: () => void;
  onOpenDetail: () => void;
  onAddTask: () => void;
  draggingId: number | null;
  onDragStart: (id: number) => void;
  onDragEnd: () => void;
  isDragging?: boolean;
  onProjDragStart?: () => void;
  onProjDragEnd?: () => void;
  expandedTasks: Set<number>;
  onToggleTask: (id: number) => void;
  onToggleMicro: (tarefaId: number, microId: number, concluida: boolean) => void;
  onTaskClick: (t: Tarefa) => void;
  onTaskStatusChange: (tarefaId: number, status: StatusKey) => void;
}) {
  const [hoverStrip, setHoverStrip] = useState<StatusKey | null>(null);

  return (
    <div
      draggable
      onDragStart={(e) => { e.stopPropagation(); onProjDragStart?.(); }}
      onDragEnd={onProjDragEnd}
      className={`rounded-xl overflow-hidden shadow-sm transition-all cursor-grab active:cursor-grabbing
        ${isDragging ? "opacity-40 scale-95" : ""}
        ${expanded ? "border-2 border-violet-300" : "border border-violet-200 hover:border-violet-300"}`}
      style={{ borderLeftWidth: expanded ? "4px" : "3px", borderLeftColor: projeto.cor }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 bg-violet-50 px-3 py-2.5">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: projeto.cor }} />
        <div className="flex-1 min-w-0">
          <span
            className="block text-sm font-semibold text-violet-900 truncate cursor-pointer hover:underline"
            onClick={(e) => { e.stopPropagation(); onOpenDetail(); }}
          >
            {projeto.nome}
          </span>
          {projeto.descricao && (
            <span className="block text-[11px] text-violet-500/80 truncate leading-tight">
              {projeto.descricao}
            </span>
          )}
        </div>
        <span className="text-xs font-medium text-violet-400 shrink-0">{tasks.length}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onAddTask(); }}
          className="shrink-0 rounded p-0.5 hover:bg-violet-200 text-violet-500 transition"
          title="Adicionar tarefa"
        >
          <Ico d={ICONS.plus} className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className="shrink-0 rounded p-0.5 hover:bg-violet-200 text-violet-500 transition"
        >
          <Ico d={expanded ? ICONS.chevUp : ICONS.chevDown} className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Tasks (expanded) */}
      {expanded && (
        <div className="bg-white">
          {/* Stage drop strip */}
          <div className="flex border-b border-violet-100">
            {COLUNAS.map((c) => (
              <div
                key={c.id}
                title={c.label}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setHoverStrip(c.id); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setHoverStrip(null); }}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setHoverStrip(null); if (draggingId) onTaskStatusChange(draggingId, c.id); }}
                className={`flex flex-1 items-center justify-center gap-1 py-1.5 transition
                  ${hoverStrip === c.id ? `${c.hdr} font-medium` : "hover:bg-neutral-50"}`}
              >
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${c.dot}`} />
                {hoverStrip === c.id && (
                  <span className="text-[9px] leading-none whitespace-nowrap">{c.label}</span>
                )}
              </div>
            ))}
          </div>

          {tasks.length === 0 ? (
            <button
              onClick={onAddTask}
              className="w-full px-3 py-3 text-center text-xs text-neutral-400 hover:text-violet-500 transition"
            >
              + Adicionar tarefa
            </button>
          ) : (
            tasks.map((t) => (
              <TarefaCard
                key={t.id}
                tarefa={t}
                compact
                onClick={() => onTaskClick(t)}
                isDragging={draggingId === t.id}
                onDragStart={() => onDragStart(t.id)}
                onDragEnd={onDragEnd}
                expanded={expandedTasks.has(t.id)}
                onToggleExpand={() => onToggleTask(t.id)}
                onToggleMicro={(mId, c) => onToggleMicro(t.id, mId, c)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── ProjetoDetalhe ─────────────────────────────────────────────────────────────
function ProjetoDetalhe({
  projeto, tarefas, onClose, onTaskClick, onUpdate,
}: {
  projeto: Projeto;
  tarefas: Tarefa[];
  onClose: () => void;
  onTaskClick: (t: Tarefa) => void;
  onUpdate?: (p: Projeto) => void;
}) {
  const [descricao, setDescricao]       = useState(projeto.descricao ?? "");
  const [visivelPortal, setVisivelPortal] = useState(projeto.visivel_portal ?? false);

  const projTasks = tarefas.filter((t) => t.projeto_id === projeto.id);
  const total     = projTasks.length;
  const done      = projTasks.filter((t) => t.status === "concluido").length;

  const grouped = COLUNAS
    .map((c) => ({ ...c, tasks: projTasks.filter((t) => t.status === c.id) }))
    .filter((c) => c.tasks.length > 0);

  async function patch(fields: Record<string, unknown>) {
    await fetch(`/api/tarefas/projetos/${projeto.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    onUpdate?.({ ...projeto, descricao: descricao.trim() || null, visivel_portal: visivelPortal, ...fields });
  }

  async function togglePortal() {
    const next = !visivelPortal;
    setVisivelPortal(next);
    await patch({ visivel_portal: next });
  }

  return (
    <div className="flex flex-col h-full w-96 shrink-0 border-l border-neutral-200 bg-white overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-neutral-100 px-5 py-4">
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: projeto.cor }} />
        <span className="flex-1 font-semibold text-neutral-900 truncate">{projeto.nome}</span>
        <button onClick={onClose} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 transition">
          <Ico d={ICONS.x} />
        </button>
      </div>

      {/* Progress */}
      {total > 0 && (
        <div className="px-5 py-3 border-b border-neutral-100">
          <div className="flex items-center justify-between text-xs text-neutral-500 mb-1.5">
            <span>Progresso</span>
            <span className="font-medium">{done}/{total} concluídas</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-neutral-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-400 transition-all"
              style={{ width: total > 0 ? `${Math.round((done / total) * 100)}%` : "0%" }}
            />
          </div>
        </div>
      )}

      <div className="flex-1 px-5 py-4 space-y-5">
        {/* Descrição */}
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-500">Descrição</label>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            onBlur={() => patch({ descricao: descricao.trim() || null })}
            rows={3}
            placeholder="Adicione uma descrição ao projeto..."
            className="w-full resize-none rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-violet-400"
          />
        </div>

        {/* Toggle portal */}
        <label className="flex cursor-pointer items-center gap-3">
          <div
            onClick={togglePortal}
            className={`relative h-5 w-9 rounded-full transition-colors ${visivelPortal ? "bg-violet-600" : "bg-neutral-200"}`}
          >
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${visivelPortal ? "left-4" : "left-0.5"}`} />
          </div>
          <span className="text-sm text-neutral-700">Visível no portal do cliente</span>
        </label>

        {/* Tasks by status */}
        {grouped.length === 0 ? (
          <p className="text-sm text-neutral-400 text-center py-4">Nenhuma tarefa neste projeto</p>
        ) : grouped.map((g) => (
          <div key={g.id}>
            <div className="flex items-center gap-1.5 mb-2">
              <span className={`h-2 w-2 rounded-full ${g.dot}`} />
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">{g.label}</span>
              <span className="text-xs text-neutral-400">({g.tasks.length})</span>
            </div>
            <div className="space-y-1">
              {g.tasks.map((t) => (
                <div key={t.id} className="rounded-lg border border-neutral-100 overflow-hidden">
                  {/* Task row */}
                  <button
                    onClick={() => onTaskClick(t)}
                    className="w-full text-left flex items-center gap-2 px-3 py-2 hover:bg-neutral-50 transition"
                  >
                    <div className={`h-3.5 w-3.5 shrink-0 rounded border flex items-center justify-center
                      ${t.status === "concluido" ? "border-emerald-500 bg-emerald-500" : "border-neutral-300"}`}>
                      {t.status === "concluido" && <Ico d={ICONS.check} className="h-2.5 w-2.5 text-white" />}
                    </div>
                    <span className={`flex-1 text-sm ${t.status === "concluido" ? "line-through text-neutral-400" : "text-neutral-700"}`}>
                      {t.titulo}
                    </span>
                    {t.microtarefas.length > 0 && (
                      <span className="text-[10px] text-neutral-400 shrink-0">
                        {t.microtarefas.filter((m) => m.concluida).length}/{t.microtarefas.length}
                      </span>
                    )}
                  </button>
                  {/* Subtasks */}
                  {t.microtarefas.length > 0 && (
                    <div className="border-t border-neutral-50 divide-y divide-neutral-50">
                      {t.microtarefas.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => onTaskClick(t)}
                          className="w-full text-left flex items-center gap-2 pl-7 pr-3 py-1.5 bg-neutral-50/50 hover:bg-neutral-100/60 transition"
                        >
                          <div className={`h-3 w-3 shrink-0 rounded border flex items-center justify-center
                            ${m.concluida ? "border-emerald-400 bg-emerald-400" : "border-neutral-300"}`}>
                            {m.concluida && <Ico d={ICONS.check} className="h-2 w-2 text-white" />}
                          </div>
                          <span className={`text-xs ${m.concluida ? "line-through text-neutral-400" : "text-neutral-500"}`}>
                            {m.texto}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── NovaTarefaModal ────────────────────────────────────────────────────────────
function NovaTarefaModal({
  projetoId, clienteId, todosProjetos, responsaveis, statusInicial, onClose, onCreate,
}: {
  projetoId: number | null;
  clienteId: number | null;
  todosProjetos: Projeto[];
  responsaveis?: Responsaveis;
  statusInicial: StatusKey;
  onClose: () => void;
  onCreate: (t: Tarefa) => void;
}) {
  const [form, setForm] = useState({
    titulo: "", descricao: "",
    prioridade: "media" as PrioKey,
    data_limite: "", responsavel: "",
    status: statusInicial,
    projeto_id: projetoId,
  });
  const [saving, setSaving] = useState(false);

  const projetosReais = todosProjetos.filter((p) => p.id !== -1);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.titulo.trim()) return;
    setSaving(true);
    try {
      let id: number;
      if (form.projeto_id !== null && form.projeto_id !== -1) {
        const res = await fetch(`/api/tarefas/projetos/${form.projeto_id}/tarefas`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clienteId, titulo: form.titulo.trim(),
            descricao: form.descricao || undefined,
            prioridade: form.prioridade,
            data_limite: form.data_limite || undefined,
            responsavel: form.responsavel || undefined,
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        ({ id } = await res.json() as { id: number });
      } else {
        const res = await fetch("/api/tarefas/tarefas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clienteId, titulo: form.titulo.trim(),
            descricao: form.descricao || undefined,
            prioridade: form.prioridade,
            data_limite: form.data_limite || undefined,
            responsavel: form.responsavel || undefined,
            status: form.status,
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        ({ id } = await res.json() as { id: number });
      }

      if (form.projeto_id !== null && form.projeto_id !== -1 && form.status !== "a_fazer") {
        await fetch(`/api/tarefas/tarefas/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: form.status }),
        });
      }

      const projetoIdReal = form.projeto_id === -1 ? null : form.projeto_id;
      // Sempre adiciona ao estado local (board mostra todas as tarefas)
      onCreate({
        id, projeto_id: projetoIdReal, cliente_id: clienteId,
        titulo: form.titulo.trim(), descricao: form.descricao || null,
        status: form.status, prioridade: form.prioridade,
        data_limite: form.data_limite || null, responsavel: form.responsavel || null,
        lead_id: null, visivel_portal: false, microtarefas: [],
      });
      onClose();
    } catch (err) {
      console.error("Erro ao criar tarefa:", err);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-100 px-6 py-4">
          <h2 className="font-semibold text-neutral-900">Nova Tarefa</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
            <Ico d={ICONS.x} />
          </button>
        </div>
        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Título *</label>
            <input
              autoFocus required
              value={form.titulo}
              onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-violet-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Projeto</label>
            <select
              value={form.projeto_id ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, projeto_id: e.target.value === "" ? null : Number(e.target.value) }))}
              className="w-full rounded-lg border border-neutral-300 px-2 py-2 text-sm outline-none focus:border-violet-500"
            >
              <option value="">Sem projeto</option>
              {projetosReais.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as StatusKey }))}
                className="w-full rounded-lg border border-neutral-300 px-2 py-2 text-sm outline-none focus:border-violet-500"
              >
                {COLUNAS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">Prioridade</label>
              <select
                value={form.prioridade}
                onChange={(e) => setForm((f) => ({ ...f, prioridade: e.target.value as PrioKey }))}
                className="w-full rounded-lg border border-neutral-300 px-2 py-2 text-sm outline-none focus:border-violet-500"
              >
                {(Object.entries(PRIO) as [PrioKey, { label: string }][]).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">Data limite</label>
              <input
                type="date"
                value={form.data_limite}
                onChange={(e) => setForm((f) => ({ ...f, data_limite: e.target.value }))}
                className="w-full rounded-lg border border-neutral-300 px-2 py-2 text-sm outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">Responsável</label>
              <select
                value={form.responsavel}
                onChange={(e) => setForm((f) => ({ ...f, responsavel: e.target.value }))}
                className="w-full rounded-lg border border-neutral-300 px-2 py-2 text-sm outline-none focus:border-violet-500"
              >
                <option value="">Sem responsável</option>
                {responsaveis?.admins.map((a) => <option key={a.nome} value={a.nome}>{a.nome}</option>)}
                {responsaveis?.clientes.map((c) => <option key={c.nome} value={c.nome}>{c.nome}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Descrição</label>
            <textarea
              rows={2}
              value={form.descricao}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              className="w-full resize-none rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-violet-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="rounded-lg border border-neutral-200 px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-50">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50">
              {saving ? "Criando..." : "Criar tarefa"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── NovoProjetoModal ───────────────────────────────────────────────────────────
function NovoProjetoModal({
  clienteId, clientes, onClose, onCreate,
}: {
  clienteId: number | null;
  clientes: Cliente[];
  onClose: () => void;
  onCreate: (p: Projeto) => void;
}) {
  const [nome, setNome]         = useState("");
  const [cor, setCor]           = useState("#6366f1");
  const [selCliente, setSelCliente] = useState<number | null>(clienteId);
  const [saving, setSaving]     = useState(false);

  const CORES = ["#6366f1","#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#14b8a6"];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    setSaving(true);
    const res = await fetch("/api/tarefas/projetos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clienteId: selCliente, nome: nome.trim(), cor }),
    });
    const { id } = await res.json() as { id: number };
    onCreate({ id, nome: nome.trim(), cor, status: "ativo", cliente_id: selCliente, coluna: "a_fazer" as StatusKey });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-100 px-6 py-4">
          <h2 className="font-semibold text-neutral-900">Novo Projeto</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
            <Ico d={ICONS.x} />
          </button>
        </div>
        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Nome *</label>
            <input
              autoFocus required value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-violet-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Cliente</label>
            <select
              value={selCliente ?? ""}
              onChange={(e) => setSelCliente(e.target.value === "" ? null : Number(e.target.value))}
              className="w-full rounded-lg border border-neutral-300 px-2 py-2 text-sm outline-none focus:border-violet-500"
            >
              <option value="">Sem cliente</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-700">Cor</label>
            <div className="flex gap-2 flex-wrap">
              {CORES.map((c) => (
                <button key={c} type="button" onClick={() => setCor(c)}
                  style={{ background: c }}
                  className={`h-7 w-7 rounded-full transition-transform ${cor === c ? "scale-125 ring-2 ring-offset-1 ring-neutral-400" : ""}`}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="rounded-lg border border-neutral-200 px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-50">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50">
              {saving ? "Criando..." : "Criar projeto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── TarefasBoard ───────────────────────────────────────────────────────────────
export function TarefasBoard({ clientes, responsaveis }: { clientes: Cliente[]; responsaveis?: Responsaveis }) {
  const [modoView, setModoView] = useState<"board" | "dashboard">("board");
  const [clienteId, setClienteId] = useState<number | null>(clientes[0]?.id ?? null);

  const [projetos, setProjetos]   = useState<Projeto[]>([]);
  const [tarefas, setTarefas]     = useState<Tarefa[]>([]);
  const [loading, setLoading]     = useState(false);

  const [detalhe, setDetalhe]         = useState<Tarefa | null>(null);
  const [detalheProj, setDetalheProj] = useState<Projeto | null>(null);

  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set());
  const [expandedTasks, setExpandedTasks]       = useState<Set<number>>(new Set());

  const [novaTarefaStatus, setNovaTarefaStatus]     = useState<StatusKey | null>(null);
  const [novaTarefaProjetoId, setNovaTarefaProjetoId] = useState<number | null>(null);
  const [showNovoProjeto, setShowNovoProjeto]         = useState(false);

  const [draggingId, setDraggingId]       = useState<number | null>(null);
  const [draggingProjId, setDraggingProjId] = useState<number | null>(null);
  const [overCol, setOverCol]             = useState<StatusKey | null>(null);

  // Busca projetos + todas as tarefas do cliente
  useEffect(() => {
    setLoading(true);
    setDetalhe(null);
    setDetalheProj(null);
    const qs = clienteId != null ? `clienteId=${clienteId}` : "";
    Promise.all([
      fetch(`/api/tarefas/projetos${qs ? `?${qs}` : ""}`).then((r) => r.json()),
      fetch(`/api/tarefas/tarefas?${qs ? `${qs}&` : ""}all=true`).then((r) => r.json()),
    ]).then(([projs, tasks]: [Projeto[], Tarefa[]]) => {
      setProjetos(projs);
      setTarefas(tasks);
    }).finally(() => setLoading(false));
  }, [clienteId]);

  function toggleProject(id: number) {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleTask(id: number) {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function cascadeProject(projId: number, currentTarefas: Tarefa[]) {
    const projTasks = currentTarefas.filter((t) => t.projeto_id === projId);
    if (projTasks.length > 0 && projTasks.every((t) => t.status === "concluido")) {
      setProjetos((prev) => prev.map((p) => p.id === projId ? { ...p, coluna: "concluido" as StatusKey } : p));
      await fetch(`/api/tarefas/projetos/${projId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coluna: "concluido" }),
      });
    }
  }

  async function handleTaskStatusChange(tarefaId: number, newStatus: StatusKey) {
    const tarefa = tarefas.find((t) => t.id === tarefaId);
    if (!tarefa || tarefa.status === newStatus) return;
    const updated = { ...tarefa, status: newStatus };
    const withUpdated = tarefas.map((t) => t.id === tarefaId ? updated : t);
    setTarefas(withUpdated);
    if (detalhe?.id === tarefaId) setDetalhe(updated);
    await fetch(`/api/tarefas/tarefas/${tarefaId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (newStatus === "concluido" && tarefa.projeto_id) {
      await cascadeProject(tarefa.projeto_id, withUpdated);
    }
  }

  async function toggleMicro(tarefaId: number, microId: number, concluida: boolean) {
    const withMicro = tarefas.map((t) =>
      t.id === tarefaId
        ? { ...t, microtarefas: t.microtarefas.map((m) => m.id === microId ? { ...m, concluida } : m) }
        : t
    );
    setTarefas(withMicro);
    if (detalhe?.id === tarefaId) {
      setDetalhe((prev) => prev
        ? { ...prev, microtarefas: prev.microtarefas.map((m) => m.id === microId ? { ...m, concluida } : m) }
        : null
      );
    }
    await fetch(`/api/tarefas/microtarefas/${microId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ concluida }),
    });
    // Cascade: all micros concluída → mark task concluído
    if (concluida) {
      const tarefa = withMicro.find((t) => t.id === tarefaId);
      if (tarefa && tarefa.microtarefas.every((m) => m.concluida) && tarefa.status !== "concluido") {
        const withStatus = withMicro.map((t) => t.id === tarefaId ? { ...t, status: "concluido" as StatusKey } : t);
        setTarefas(withStatus);
        if (detalhe?.id === tarefaId) setDetalhe((prev) => prev ? { ...prev, status: "concluido" } : null);
        await fetch(`/api/tarefas/tarefas/${tarefaId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "concluido" }),
        });
        if (tarefa.projeto_id) await cascadeProject(tarefa.projeto_id, withStatus);
      }
    }
  }

  function handleUpdate(t: Tarefa) {
    setTarefas((prev) => prev.map((x) => x.id === t.id ? t : x));
    setDetalhe(t);
  }

  function handleDelete(id: number) {
    setTarefas((prev) => prev.filter((x) => x.id !== id));
    setDetalhe(null);
  }

  function handleCreate(t: Tarefa) {
    setTarefas((prev) => [...prev, t]);
  }

  async function handleDropStatus(newStatus: StatusKey) {
    if (!draggingId) return;
    const tarefa = tarefas.find((t) => t.id === draggingId);
    setDraggingId(null);
    setOverCol(null);
    if (!tarefa || tarefa.status === newStatus) return;
    const updated = { ...tarefa, status: newStatus };
    const withUpdated = tarefas.map((t) => t.id === draggingId ? updated : t);
    setTarefas(withUpdated);
    if (detalhe?.id === draggingId) setDetalhe(updated);
    await fetch(`/api/tarefas/tarefas/${draggingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (newStatus === "concluido" && tarefa.projeto_id) {
      await cascadeProject(tarefa.projeto_id, withUpdated);
    }
  }

  async function handleDropProject(newColuna: StatusKey) {
    if (!draggingProjId) return;
    const projId = draggingProjId;
    setDraggingProjId(null);
    setOverCol(null);
    setProjetos((prev) => prev.map((p) => p.id === projId ? { ...p, coluna: newColuna } : p));
    await fetch(`/api/tarefas/projetos/${projId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coluna: newColuna }),
    });
  }

  function openNovaTarefa(status: StatusKey, projetoId: number | null = null) {
    setNovaTarefaProjetoId(projetoId);
    setNovaTarefaStatus(status);
  }

  return (
    <div className="flex h-screen flex-col bg-neutral-50">
      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 border-b border-neutral-200 bg-white px-6 py-3">
        <div className="flex shrink-0 items-center gap-2">
          <Ico d={ICONS.folder} className="h-5 w-5 text-violet-600" />
          <span className="text-sm font-semibold text-neutral-900">Tarefas</span>
        </div>

        <div className="flex shrink-0 rounded-lg border border-neutral-200 bg-neutral-50 p-0.5">
          {(["board", "dashboard"] as const).map((v) => (
            <button key={v} onClick={() => setModoView(v)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                modoView === v ? "bg-white shadow text-neutral-900" : "text-neutral-500 hover:text-neutral-700"
              }`}>
              {v === "board" ? "Projetos" : "Dashboard"}
            </button>
          ))}
        </div>

        {modoView === "board" && (<>
          <select
            value={clienteId ?? ""}
            onChange={(e) => setClienteId(e.target.value === "" ? null : Number(e.target.value))}
            className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-700 outline-none focus:border-violet-400"
          >
            <option value="">Sem cliente</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>

          <button
            onClick={() => setShowNovoProjeto(true)}
            className="flex items-center gap-1.5 rounded-lg border border-dashed border-neutral-300 px-3 py-1.5 text-sm text-neutral-400 hover:border-violet-400 hover:text-violet-600 transition"
          >
            <Ico d={ICONS.plus} className="h-3.5 w-3.5" />
            Novo Projeto
          </button>
        </>)}
      </div>

      {/* ── Dashboard ── */}
      {modoView === "dashboard" && (
        <DashboardView
          clientes={clientes}
          responsaveis={responsaveis}
          onNovaTarefa={() => openNovaTarefa("a_fazer")}
        />
      )}

      {/* ── Board ── */}
      {modoView === "board" && (
        <div className="flex flex-1 overflow-hidden">
          {/* Kanban */}
          <div className="flex flex-1 gap-4 overflow-x-auto px-6 py-5">
            {loading ? (
              <div className="flex flex-1 items-center justify-center">
                <span className="text-sm text-neutral-400 animate-pulse">Carregando...</span>
              </div>
            ) : (
              COLUNAS.map((col) => {
                const colTasks       = tarefas.filter((t) => t.status === col.id);
                const projetosNaCol  = projetos.filter((p) => (p.coluna ?? "a_fazer") === col.id);
                const semProj        = colTasks.filter((t) => t.projeto_id === null);
                // tasks de projetos cujo projeto está em outra coluna → aparecem como cards standalone
                const projTasksInCol = colTasks.filter((t) =>
                  t.projeto_id !== null &&
                  (projetos.find((p) => p.id === t.projeto_id)?.coluna ?? "a_fazer") !== col.id
                );
                const isOver         = overCol === col.id && (draggingId !== null || draggingProjId !== null);

                return (
                  <div key={col.id} className="flex w-72 shrink-0 flex-col gap-3">
                    {/* Column header */}
                    <div className={`flex items-center justify-between rounded-xl px-3 py-2 ${col.hdr}`}>
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                        <span className="text-xs font-semibold uppercase tracking-wide">{col.label}</span>
                        <span className="rounded-full bg-white/60 px-1.5 text-xs font-semibold">{colTasks.length}</span>
                      </div>
                      <button
                        onClick={() => openNovaTarefa(col.id)}
                        className="rounded-lg p-1 hover:bg-white/50 transition"
                      >
                        <Ico d={ICONS.plus} className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Drop zone */}
                    <div
                      className={`flex flex-col gap-2 min-h-[4rem] rounded-xl transition-colors
                        ${isOver ? "bg-violet-50 ring-2 ring-violet-200 ring-inset" : ""}`}
                      onDragOver={(e) => { e.preventDefault(); if (overCol !== col.id) setOverCol(col.id); }}
                      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverCol(null); }}
                      onDrop={(e) => { e.preventDefault(); draggingProjId ? handleDropProject(col.id) : handleDropStatus(col.id); }}
                    >
                      {/* Project cards */}
                      {projetosNaCol.map((proj) => (
                        <ProjetoCard
                          key={proj.id}
                          projeto={proj}
                          tasks={tarefas.filter((t) => t.projeto_id === proj.id)}
                          expanded={expandedProjects.has(proj.id)}
                          onToggle={() => toggleProject(proj.id)}
                          onOpenDetail={() => { setDetalheProj(proj); setDetalhe(null); }}
                          onAddTask={() => openNovaTarefa(col.id, proj.id)}
                          draggingId={draggingId}
                          onDragStart={(id) => setDraggingId(id)}
                          onDragEnd={() => { setDraggingId(null); setOverCol(null); }}
                          isDragging={draggingProjId === proj.id}
                          onProjDragStart={() => setDraggingProjId(proj.id)}
                          onProjDragEnd={() => { setDraggingProjId(null); setOverCol(null); }}
                          expandedTasks={expandedTasks}
                          onToggleTask={toggleTask}
                          onToggleMicro={toggleMicro}
                          onTaskClick={(t) => { setDetalhe(t); setDetalheProj(null); }}
                          onTaskStatusChange={handleTaskStatusChange}
                        />
                      ))}

                      {/* Tasks without project */}
                      {semProj.map((t) => (
                        <TarefaCard
                          key={t.id}
                          tarefa={t}
                          onClick={() => { setDetalhe(t); setDetalheProj(null); }}
                          onDragStart={() => setDraggingId(t.id)}
                          onDragEnd={() => { setDraggingId(null); setOverCol(null); }}
                          isDragging={draggingId === t.id}
                          expanded={expandedTasks.has(t.id)}
                          onToggleExpand={() => toggleTask(t.id)}
                          onToggleMicro={(mId, c) => toggleMicro(t.id, mId, c)}
                        />
                      ))}

                      {/* Tasks de projetos que estão em outra coluna */}
                      {projTasksInCol.map((t) => {
                        const proj = projetos.find((p) => p.id === t.projeto_id);
                        return (
                          <TarefaCard
                            key={`pt-${t.id}`}
                            tarefa={t}
                            projetoNome={proj?.nome}
                            projetoCor={proj?.cor}
                            onClick={() => { setDetalhe(t); setDetalheProj(null); }}
                            onDragStart={() => setDraggingId(t.id)}
                            onDragEnd={() => { setDraggingId(null); setOverCol(null); }}
                            isDragging={draggingId === t.id}
                            expanded={expandedTasks.has(t.id)}
                            onToggleExpand={() => toggleTask(t.id)}
                            onToggleMicro={(mId, c) => toggleMicro(t.id, mId, c)}
                          />
                        );
                      })}

                      {/* Empty state */}
                      {projetosNaCol.length === 0 && semProj.length === 0 && projTasksInCol.length === 0 && !isOver && (
                        <button
                          onClick={() => openNovaTarefa(col.id)}
                          className="rounded-xl border-2 border-dashed border-neutral-200 py-4 text-center text-xs text-neutral-400 hover:border-violet-300 hover:text-violet-500 transition"
                        >
                          + Adicionar tarefa
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Side panel */}
          {detalhe && (
            <TarefaDetalhe
              tarefa={detalhe}
              todosProjetos={projetos}
              responsaveis={responsaveis}
              onClose={() => setDetalhe(null)}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          )}
          {detalheProj && !detalhe && (
            <ProjetoDetalhe
              projeto={detalheProj}
              tarefas={tarefas}
              onClose={() => setDetalheProj(null)}
              onTaskClick={(t) => { setDetalhe(t); setDetalheProj(null); }}
              onUpdate={(p) => { setProjetos((prev) => prev.map((x) => x.id === p.id ? p : x)); setDetalheProj(p); }}
            />
          )}
        </div>
      )}

      {/* ── Modals ── */}
      {novaTarefaStatus && (
        <NovaTarefaModal
          projetoId={novaTarefaProjetoId}
          clienteId={clienteId}
          todosProjetos={projetos}
          responsaveis={responsaveis}
          statusInicial={novaTarefaStatus}
          onClose={() => setNovaTarefaStatus(null)}
          onCreate={handleCreate}
        />
      )}
      {showNovoProjeto && (
        <NovoProjetoModal
          clienteId={clienteId}
          clientes={clientes}
          onClose={() => setShowNovoProjeto(false)}
          onCreate={(p) => setProjetos((prev) => [...prev, p])}
        />
      )}
    </div>
  );
}
