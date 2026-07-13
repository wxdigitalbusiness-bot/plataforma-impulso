"use client";

import { useCallback, useEffect, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────
export type Micro     = { id: number; texto: string; concluida: boolean; ordem: number };
export type StatusKey = "a_fazer" | "em_andamento" | "em_revisao" | "concluido";
export type PrioKey   = "baixa" | "media" | "alta" | "urgente";
export type Projeto   = { id: number; nome: string; cor: string; status: string; cliente_id: number | null };

export type Tarefa = {
  id: number; projeto_id: number | null; cliente_id: number | null;
  titulo: string; descricao: string | null;
  status: StatusKey; prioridade: PrioKey;
  data_limite: string | null; responsavel: string | null;
  lead_id: string | null; lead_nome?: string | null; visivel_portal: boolean;
  microtarefas: Micro[];
};

// ── Config ─────────────────────────────────────────────────────────────────────
const COLUNAS: { id: StatusKey; label: string }[] = [
  { id: "a_fazer",      label: "A Fazer" },
  { id: "em_andamento", label: "Em Andamento" },
  { id: "em_revisao",   label: "Em Revisão" },
  { id: "concluido",    label: "Concluído" },
];

export const PRIO: Record<PrioKey, { label: string; cls: string }> = {
  baixa:   { label: "Baixa",   cls: "bg-neutral-100 text-neutral-500" },
  media:   { label: "Média",   cls: "bg-blue-100 text-blue-700" },
  alta:    { label: "Alta",    cls: "bg-amber-100 text-amber-700" },
  urgente: { label: "Urgente", cls: "bg-red-100 text-red-700" },
};

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
  x:     "M6 18L18 6M6 6l12 12",
  plus:  "M12 4v16m8-8H4",
  check: "M5 13l4 4L19 7",
  trash: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16",
  link:  "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1",
};

// ── TarefaDetalhe ──────────────────────────────────────────────────────────────
type Responsaveis = { admins: { nome: string }[]; clientes: { nome: string }[] };

export function TarefaDetalhe({
  tarefa, todosProjetos = [], responsaveis: responsaveisProp, onClose, onUpdate, onDelete,
}: {
  tarefa: Tarefa;
  todosProjetos?: Projeto[];
  responsaveis?: Responsaveis;
  onClose: () => void;
  onUpdate: (t: Tarefa) => void;
  onDelete: (id: number) => void;
}) {
  const [local, setLocal]         = useState<Tarefa>(tarefa);
  const [novoMicro, setNovoMicro] = useState("");
  const [saving, setSaving]       = useState(false);
  const [responsaveis, setResp]   = useState<Responsaveis | null>(responsaveisProp ?? null);

  useEffect(() => { setLocal(tarefa); }, [tarefa]);

  useEffect(() => {
    if (responsaveisProp) return;
    fetch("/api/tarefas/responsaveis")
      .then((r) => r.json())
      .then(setResp)
      .catch(() => {});
  }, [responsaveisProp]);

  const patch = useCallback(async (fields: Partial<Tarefa & { projeto_id: number | null }>) => {
    const merged = { ...local, ...fields };
    setLocal(merged);
    onUpdate(merged);
    await fetch(`/api/tarefas/tarefas/${tarefa.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
  }, [local, tarefa.id, onUpdate]);

  async function addMicro() {
    const txt = novoMicro.trim();
    if (!txt) return;
    setSaving(true);
    const res = await fetch(`/api/tarefas/tarefas/${tarefa.id}/microtarefas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto: txt }),
    });
    const nova = await res.json() as Micro;
    const updated = { ...local, microtarefas: [...local.microtarefas, nova] };
    setLocal(updated); onUpdate(updated);
    setNovoMicro("");
    setSaving(false);
  }

  async function toggleMicro(m: Micro) {
    const updated = {
      ...local,
      microtarefas: local.microtarefas.map((x) => x.id === m.id ? { ...x, concluida: !x.concluida } : x),
    };
    setLocal(updated); onUpdate(updated);
    await fetch(`/api/tarefas/microtarefas/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ concluida: !m.concluida }),
    });
  }

  async function deleteMicro(id: number) {
    const updated = { ...local, microtarefas: local.microtarefas.filter((m) => m.id !== id) };
    setLocal(updated); onUpdate(updated);
    await fetch(`/api/tarefas/microtarefas/${id}`, { method: "DELETE" });
  }

  async function handleDelete() {
    if (!confirm("Excluir tarefa?")) return;
    await fetch(`/api/tarefas/tarefas/${tarefa.id}`, { method: "DELETE" });
    onDelete(tarefa.id);
  }

  const projetosReais = todosProjetos.filter((p) => p.id !== -1);

  return (
    <div className="flex flex-col h-full w-96 shrink-0 border-l border-neutral-200 bg-white overflow-y-auto">
      <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Tarefa</span>
        <div className="flex items-center gap-2">
          <button onClick={handleDelete} className="rounded-lg p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-500 transition">
            <Ico d={ICONS.trash} />
          </button>
          <button onClick={onClose} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 transition">
            <Ico d={ICONS.x} />
          </button>
        </div>
      </div>

      <div className="flex-1 px-5 py-4 space-y-5">
        {/* Título */}
        <input
          key={tarefa.id}
          defaultValue={local.titulo}
          onBlur={(e) => { if (e.target.value.trim() && e.target.value !== tarefa.titulo) patch({ titulo: e.target.value.trim() }); }}
          className="w-full text-base font-semibold text-neutral-900 outline-none border-b border-transparent focus:border-neutral-200 pb-1"
        />

        {/* Status + Prioridade */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500">Status</label>
            <select
              value={local.status}
              onChange={(e) => patch({ status: e.target.value as StatusKey })}
              className="w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-sm outline-none focus:border-violet-400"
            >
              {COLUNAS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500">Prioridade</label>
            <select
              value={local.prioridade}
              onChange={(e) => patch({ prioridade: e.target.value as PrioKey })}
              className="w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-sm outline-none focus:border-violet-400"
            >
              {(Object.entries(PRIO) as [PrioKey, { label: string }][]).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Data limite + Responsável */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500">Data limite</label>
            <input
              type="date"
              value={local.data_limite ?? ""}
              onChange={(e) => patch({ data_limite: e.target.value || null })}
              className="w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-sm outline-none focus:border-violet-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500">Responsável</label>
            <select
              value={local.responsavel ?? ""}
              onChange={(e) => patch({ responsavel: e.target.value || null })}
              className="w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-sm outline-none focus:border-violet-400"
            >
              <option value="">Sem responsável</option>
              {responsaveis && responsaveis.admins.length > 0 && (
                <optgroup label="Equipe">
                  {responsaveis.admins.map((a) => (
                    <option key={a.nome} value={a.nome}>{a.nome}</option>
                  ))}
                </optgroup>
              )}
              {responsaveis && responsaveis.clientes.length > 0 && (
                <optgroup label="Clientes">
                  {responsaveis.clientes.map((c) => (
                    <option key={c.nome} value={c.nome}>{c.nome}</option>
                  ))}
                </optgroup>
              )}
              {/* Mantém valor existente mesmo sem carregar a lista ainda */}
              {local.responsavel && responsaveis !== null &&
                ![...responsaveis.admins, ...responsaveis.clientes].some((x) => x.nome === local.responsavel) && (
                <option value={local.responsavel}>{local.responsavel}</option>
              )}
            </select>
          </div>
        </div>

        {/* Lead vinculado */}
        {tarefa.lead_nome && (
          <div className="flex items-center gap-2 rounded-lg bg-violet-50 px-3 py-2 text-sm text-violet-700">
            <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" />
            </svg>
            <span className="font-medium">Lead:</span>
            <span className="truncate">{tarefa.lead_nome}</span>
          </div>
        )}

        {/* Projeto (vincular) — só mostra se houver projetos disponíveis */}
        {projetosReais.length > 0 && (
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
              <Ico d={ICONS.link} className="h-3 w-3" />
              Projeto
            </label>
            <select
              value={local.projeto_id ?? ""}
              onChange={(e) => {
                const val = e.target.value === "" ? null : Number(e.target.value);
                patch({ projeto_id: val });
              }}
              className="w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-sm outline-none focus:border-violet-400"
            >
              <option value="">Sem projeto</option>
              {projetosReais.map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </div>
        )}

        {/* Visível no portal */}
        <label className="flex cursor-pointer items-center gap-3">
          <div
            onClick={() => patch({ visivel_portal: !local.visivel_portal })}
            className={`relative h-5 w-9 rounded-full transition-colors ${local.visivel_portal ? "bg-violet-600" : "bg-neutral-200"}`}
          >
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${local.visivel_portal ? "left-4" : "left-0.5"}`} />
          </div>
          <span className="text-sm text-neutral-700">Visível no portal do cliente</span>
        </label>

        {/* Descrição */}
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-500">Descrição</label>
          <textarea
            key={tarefa.id + "-desc"}
            defaultValue={local.descricao ?? ""}
            onBlur={(e) => patch({ descricao: e.target.value || null })}
            rows={3}
            placeholder="Adicione uma descrição..."
            className="w-full resize-none rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-violet-400"
          />
        </div>

        {/* Sub-tarefas */}
        <div>
          <label className="mb-2 block text-xs font-medium text-neutral-500">
            Sub-tarefas
            {local.microtarefas.length > 0 && (
              <span className="ml-1.5 text-neutral-400">
                {local.microtarefas.filter((m) => m.concluida).length}/{local.microtarefas.length}
              </span>
            )}
          </label>
          <div className="space-y-1.5">
            {local.microtarefas.map((m) => (
              <div key={m.id} className="group flex items-center gap-2 rounded-lg border border-neutral-100 px-2.5 py-1.5 hover:bg-neutral-50">
                <button
                  onClick={() => toggleMicro(m)}
                  className={`h-4 w-4 shrink-0 rounded border transition ${m.concluida ? "border-emerald-500 bg-emerald-500 text-white" : "border-neutral-300 bg-white"}`}
                >
                  {m.concluida && <Ico d={ICONS.check} className="h-3 w-3" />}
                </button>
                <span className={`flex-1 text-sm ${m.concluida ? "line-through text-neutral-400" : "text-neutral-700"}`}>
                  {m.texto}
                </span>
                <button
                  onClick={() => deleteMicro(m.id)}
                  className="shrink-0 text-neutral-300 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                >
                  <Ico d={ICONS.x} className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              value={novoMicro}
              onChange={(e) => setNovoMicro(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addMicro(); } }}
              placeholder="Nova sub-tarefa..."
              className="flex-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm outline-none focus:border-violet-400"
            />
            <button
              onClick={addMicro}
              disabled={!novoMicro.trim() || saving}
              className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm text-white hover:bg-violet-700 disabled:opacity-40"
            >
              <Ico d={ICONS.plus} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
