"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────
type Cliente  = { id: number; nome: string };
type Projeto  = { id: number; nome: string; cor: string; status: string; cliente_id: number | null };
type Micro    = { id: number; texto: string; concluida: boolean; ordem: number };
type Tarefa   = {
  id: number; projeto_id: number | null; cliente_id: number | null;
  titulo: string; descricao: string | null;
  status: StatusKey; prioridade: PrioKey;
  data_limite: string | null; responsavel: string | null;
  lead_id: string | null; visivel_portal: boolean;
  microtarefas: Micro[];
};

type StatusKey = "a_fazer" | "em_andamento" | "em_revisao" | "concluido";
type PrioKey   = "baixa" | "media" | "alta" | "urgente";

// ── Pseudo-projeto "Sem projeto" ───────────────────────────────────────────────
// id=-1 mapeia para projeto_id=null no banco
const SEM_PROJETO: Projeto = { id: -1, nome: "Sem projeto", cor: "#94a3b8", status: "ativo", cliente_id: null };

// ── Config ─────────────────────────────────────────────────────────────────────
const COLUNAS: { id: StatusKey; label: string; hdr: string; dot: string }[] = [
  { id: "a_fazer",      label: "A Fazer",       hdr: "bg-neutral-100 text-neutral-700", dot: "bg-neutral-400" },
  { id: "em_andamento", label: "Em Andamento",   hdr: "bg-blue-50 text-blue-700",       dot: "bg-blue-500" },
  { id: "em_revisao",   label: "Em Revisão",     hdr: "bg-amber-50 text-amber-700",     dot: "bg-amber-500" },
  { id: "concluido",    label: "Concluído",      hdr: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
];

const PRIO: Record<PrioKey, { label: string; cls: string }> = {
  baixa:   { label: "Baixa",   cls: "bg-neutral-100 text-neutral-500" },
  media:   { label: "Média",   cls: "bg-blue-100 text-blue-700" },
  alta:    { label: "Alta",    cls: "bg-amber-100 text-amber-700" },
  urgente: { label: "Urgente", cls: "bg-red-100 text-red-700" },
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
  x:      "M6 18L18 6M6 6l12 12",
  plus:   "M12 4v16m8-8H4",
  check:  "M5 13l4 4L19 7",
  trash:  "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16",
  cal:    "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  folder: "M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z",
  link:   "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1",
};

// ── TarefaCard ─────────────────────────────────────────────────────────────────
function TarefaCard({ tarefa, onClick }: { tarefa: Tarefa; onClick: () => void }) {
  const done    = tarefa.microtarefas.filter((m) => m.concluida).length;
  const total   = tarefa.microtarefas.length;
  const overdue = isOverdue(tarefa.data_limite);

  return (
    <div
      onClick={onClick}
      className="cursor-pointer rounded-xl border border-neutral-200 bg-white p-3 shadow-sm
                 hover:border-neutral-300 hover:shadow transition-all space-y-2"
    >
      <p className="text-sm font-medium text-neutral-900 leading-snug">{tarefa.titulo}</p>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${PRIO[tarefa.prioridade].cls}`}>
          {PRIO[tarefa.prioridade].label}
        </span>
        {tarefa.visivel_portal && (
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-700">
            Portal
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
        {total > 0 && (
          <span className="flex items-center gap-1">
            <Ico d={ICONS.check} className="h-3 w-3" />
            {done}/{total}
          </span>
        )}
      </div>

      {total > 0 && (
        <div className="h-1 w-full rounded-full bg-neutral-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-400 transition-all"
            style={{ width: `${Math.round((done / total) * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ── TarefaDetalhe (painel direito) ─────────────────────────────────────────────
function TarefaDetalhe({
  tarefa, clientes, todosProjetos, currentProjetoId, onClose, onUpdate, onDelete,
}: {
  tarefa: Tarefa;
  clientes: Cliente[];
  todosProjetos: Projeto[];        // todos os projetos carregados para o seletor
  currentProjetoId: number | null; // -1 = sem projeto
  onClose: () => void;
  onUpdate: (t: Tarefa) => void;
  onDelete: (id: number) => void;
}) {
  const [local, setLocal]         = useState<Tarefa>(tarefa);
  const [novoMicro, setNovoMicro] = useState("");
  const [saving, setSaving]       = useState(false);

  useEffect(() => { setLocal(tarefa); }, [tarefa]);

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

  // Projetos disponíveis: todos exceto o pseudo "Sem projeto" (id=-1)
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
            <input
              type="text"
              defaultValue={local.responsavel ?? ""}
              onBlur={(e) => patch({ responsavel: e.target.value || null })}
              placeholder="Nome"
              className="w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-sm outline-none focus:border-violet-400"
            />
          </div>
        </div>

        {/* Projeto (vincular) */}
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

// ── NovaTarefaModal ────────────────────────────────────────────────────────────
function NovaTarefaModal({
  projetoId, clienteId, todosProjetos, statusInicial, onClose, onCreate,
}: {
  projetoId: number | null;  // null = sem projeto
  clienteId: number | null;
  todosProjetos: Projeto[];
  statusInicial: StatusKey;
  onClose: () => void;
  onCreate: (t: Tarefa) => void;
}) {
  const [form, setForm] = useState({
    titulo: "", descricao: "",
    prioridade: "media" as PrioKey,
    data_limite: "", responsavel: "",
    status: statusInicial,
    projeto_id: projetoId,  // pode mudar no form
  });
  const [saving, setSaving] = useState(false);

  const projetosReais = todosProjetos.filter((p) => p.id !== -1);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.titulo.trim()) return;
    setSaving(true);

    let id: number;
    if (form.projeto_id !== null && form.projeto_id !== -1) {
      // com projeto
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
      ({ id } = await res.json() as { id: number });
    } else {
      // sem projeto
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
      ({ id } = await res.json() as { id: number });
    }

    // Patch status se não for padrão e veio de projeto
    if (form.projeto_id !== null && form.projeto_id !== -1 && form.status !== "a_fazer") {
      await fetch(`/api/tarefas/tarefas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: form.status }),
      });
    }

    // Só aparece no board atual se o projeto bater
    const projetoIdReal = form.projeto_id === -1 ? null : form.projeto_id;
    if (projetoIdReal === projetoId || (projetoId === -1 && projetoIdReal === null)) {
      onCreate({
        id, projeto_id: projetoIdReal, cliente_id: clienteId,
        titulo: form.titulo.trim(), descricao: form.descricao || null,
        status: form.status, prioridade: form.prioridade,
        data_limite: form.data_limite || null, responsavel: form.responsavel || null,
        lead_id: null, visivel_portal: false, microtarefas: [],
      });
    }
    onClose();
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

          {/* Projeto (pode mudar mesmo que já venha com um) */}
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
              <input
                type="text"
                value={form.responsavel}
                onChange={(e) => setForm((f) => ({ ...f, responsavel: e.target.value }))}
                placeholder="Nome"
                className="w-full rounded-lg border border-neutral-300 px-2 py-2 text-sm outline-none focus:border-violet-500"
              />
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
  const [nome, setNome]           = useState("");
  const [cor, setCor]             = useState("#6366f1");
  const [selectedCliente, setSelectedCliente] = useState<number | null>(clienteId);
  const [saving, setSaving]       = useState(false);

  const CORES = ["#6366f1","#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#14b8a6"];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    setSaving(true);
    const res = await fetch("/api/tarefas/projetos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clienteId: selectedCliente, nome: nome.trim(), cor }),
    });
    const { id } = await res.json() as { id: number };
    onCreate({ id, nome: nome.trim(), cor, status: "ativo", cliente_id: selectedCliente });
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

          {/* Cliente (opcional) */}
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Cliente</label>
            <select
              value={selectedCliente ?? ""}
              onChange={(e) => setSelectedCliente(e.target.value === "" ? null : Number(e.target.value))}
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
                <button
                  key={c} type="button" onClick={() => setCor(c)}
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

// ── TarefasBoard (componente principal) ────────────────────────────────────────
export function TarefasBoard({ clientes }: { clientes: Cliente[] }) {
  // null = "Sem cliente"
  const [clienteId, setClienteId] = useState<number | null>(clientes[0]?.id ?? null);
  const [projetos, setProjetos]   = useState<Projeto[]>([]);
  const [projetoId, setProjetoId] = useState<number | null>(null);
  const [tarefas, setTarefas]     = useState<Tarefa[]>([]);
  const [loadingP, setLoadingP]   = useState(false);
  const [loadingT, setLoadingT]   = useState(false);
  const [detalhe, setDetalhe]     = useState<Tarefa | null>(null);
  const [novaTarefaStatus, setNovaTarefaStatus] = useState<StatusKey | null>(null);
  const [showNovoProjeto, setShowNovoProjeto]   = useState(false);

  // Carrega projetos ao trocar cliente (null = sem cliente)
  useEffect(() => {
    setLoadingP(true);
    setProjetoId(null);
    setTarefas([]);
    const qs = clienteId != null ? `?clienteId=${clienteId}` : "";
    fetch(`/api/tarefas/projetos${qs}`)
      .then((r) => r.json())
      .then((rows: Projeto[]) => {
        // Sempre adiciona "Sem projeto" no final
        setProjetos([...rows, SEM_PROJETO]);
        setProjetoId(rows.length > 0 ? rows[0].id : -1);
      })
      .finally(() => setLoadingP(false));
  }, [clienteId]);

  // Carrega tarefas ao trocar projeto
  useEffect(() => {
    if (projetoId === null) return;
    setLoadingT(true);
    const url = projetoId === -1
      ? `/api/tarefas/tarefas${clienteId != null ? `?clienteId=${clienteId}` : ""}`
      : `/api/tarefas/projetos/${projetoId}/tarefas`;
    fetch(url)
      .then((r) => r.json())
      .then((rows: Tarefa[]) => setTarefas(rows))
      .finally(() => setLoadingT(false));
  }, [projetoId, clienteId]);

  // Ao atualizar tarefa: se o projeto mudou → remove da vista atual
  function handleUpdate(t: Tarefa) {
    const currentDbProjeto = projetoId === -1 ? null : projetoId;
    if (t.projeto_id !== currentDbProjeto) {
      setTarefas((prev) => prev.filter((x) => x.id !== t.id));
      setDetalhe(null);
    } else {
      setTarefas((prev) => prev.map((x) => (x.id === t.id ? t : x)));
      setDetalhe(t);
    }
  }

  function handleDelete(id: number) {
    setTarefas((prev) => prev.filter((x) => x.id !== id));
    setDetalhe(null);
  }

  function handleCreate(t: Tarefa) {
    setTarefas((prev) => [...prev, t]);
  }

  return (
    <div className="flex h-screen flex-col bg-neutral-50">
      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 border-b border-neutral-200 bg-white px-6 py-3 overflow-x-auto">
        <div className="flex shrink-0 items-center gap-2">
          <Ico d={ICONS.folder} className="h-5 w-5 text-violet-600" />
          <span className="text-sm font-semibold text-neutral-900">Tarefas</span>
        </div>

        {/* Seletor de cliente */}
        <select
          value={clienteId ?? ""}
          onChange={(e) => setClienteId(e.target.value === "" ? null : Number(e.target.value))}
          className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-700 outline-none focus:border-violet-400"
        >
          <option value="">Sem cliente</option>
          {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>

        {/* Abas de projetos */}
        <div className="flex items-center gap-1">
          {loadingP ? (
            <span className="text-xs text-neutral-400">Carregando...</span>
          ) : (
            projetos.map((p) => (
              <button
                key={p.id}
                onClick={() => setProjetoId(p.id)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  projetoId === p.id ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.cor }} />
                {p.nome}
              </button>
            ))
          )}
          <button
            onClick={() => setShowNovoProjeto(true)}
            className="flex items-center gap-1.5 rounded-lg border border-dashed border-neutral-300 px-3 py-1.5 text-sm text-neutral-400 hover:border-violet-400 hover:text-violet-600 transition"
          >
            <Ico d={ICONS.plus} className="h-3.5 w-3.5" />
            Projeto
          </button>
        </div>
      </div>

      {/* ── Board ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Kanban */}
        <div className="flex flex-1 gap-4 overflow-x-auto px-6 py-5">
          {projetoId === null ? (
            <div className="flex flex-1 items-center justify-center">
              <span className="text-sm text-neutral-400">Selecione ou crie um projeto.</span>
            </div>
          ) : loadingT ? (
            <div className="flex flex-1 items-center justify-center">
              <span className="text-sm text-neutral-400">Carregando...</span>
            </div>
          ) : (
            COLUNAS.map((col) => {
              const cards = tarefas.filter((t) => t.status === col.id);
              return (
                <div key={col.id} className="flex w-72 shrink-0 flex-col gap-3">
                  <div className={`flex items-center justify-between rounded-xl px-3 py-2 ${col.hdr}`}>
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                      <span className="text-xs font-semibold uppercase tracking-wide">{col.label}</span>
                      <span className="rounded-full bg-white/60 px-1.5 text-xs font-semibold">{cards.length}</span>
                    </div>
                    <button onClick={() => setNovaTarefaStatus(col.id)} className="rounded-lg p-1 hover:bg-white/50 transition">
                      <Ico d={ICONS.plus} className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="flex flex-col gap-2">
                    {cards.map((t) => (
                      <TarefaCard key={t.id} tarefa={t} onClick={() => setDetalhe(t)} />
                    ))}
                    {cards.length === 0 && (
                      <button
                        onClick={() => setNovaTarefaStatus(col.id)}
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

        {/* Painel de detalhe */}
        {detalhe && (
          <TarefaDetalhe
            tarefa={detalhe}
            clientes={clientes}
            todosProjetos={projetos}
            currentProjetoId={projetoId}
            onClose={() => setDetalhe(null)}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        )}
      </div>

      {/* ── Modals ── */}
      {novaTarefaStatus && projetoId !== null && (
        <NovaTarefaModal
          projetoId={projetoId === -1 ? null : projetoId}
          clienteId={clienteId}
          todosProjetos={projetos}
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
          onCreate={(p) => {
            // Insere antes do SEM_PROJETO
            setProjetos((prev) => [...prev.filter((x) => x.id !== -1), p, SEM_PROJETO]);
            setProjetoId(p.id);
          }}
        />
      )}
    </div>
  );
}
