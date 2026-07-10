import { getPortalSession } from "@/lib/portal-session";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type TarefaRow = {
  id: number; titulo: string; descricao: string | null;
  status: string; prioridade: string;
  data_limite: string | null; responsavel: string | null;
  lead_nome: string | null; projeto_nome: string | null;
};
type MicroRow = { id: number; tarefa_id: number; texto: string; concluida: boolean };

const STATUS_LABEL: Record<string, string> = {
  a_fazer: "A Fazer", em_andamento: "Em Andamento",
  em_revisao: "Em Revisão", concluido: "Concluído",
};
const PRIO_CLS: Record<string, string> = {
  baixa: "bg-neutral-100 text-neutral-500",
  media: "bg-blue-100 text-blue-700",
  alta:  "bg-amber-100 text-amber-700",
  urgente: "bg-red-100 text-red-700",
};
const PRIO_LABEL: Record<string, string> = {
  baixa: "Baixa", media: "Média", alta: "Alta", urgente: "Urgente",
};

function fmtDate(dl: string | null) {
  if (!dl) return null;
  const [y, m, d] = dl.split("-");
  return `${d}/${m}/${y}`;
}
function isOverdue(dl: string | null, concluido: boolean) {
  if (!dl || concluido) return false;
  return new Date(dl + "T23:59:59") < new Date();
}

export default async function PortalTarefasPage() {
  const session = await getPortalSession();
  if (!session) redirect("/portal/login");

  const tarefasRaw = await db.$queryRaw<TarefaRow[]>`
    SELECT ct.id, ct.titulo, ct.descricao, ct.status, ct.prioridade,
           ct.data_limite::text, ct.responsavel,
           fl.lead_nome,
           cp.nome AS projeto_nome
    FROM crm_tarefas ct
    LEFT JOIN fb_leads fl ON fl.lead_id = ct.lead_id
    LEFT JOIN crm_projetos cp ON cp.id = ct.projeto_id
    WHERE ct.cliente_id = ${session.clienteId}
      AND ct.visivel_portal = true
    ORDER BY
      CASE ct.status
        WHEN 'a_fazer'      THEN 1
        WHEN 'em_andamento' THEN 2
        WHEN 'em_revisao'   THEN 3
        WHEN 'concluido'    THEN 4
        ELSE 5
      END,
      ct.data_limite ASC NULLS LAST,
      ct.criado_em DESC
  `;

  const micros = tarefasRaw.length > 0
    ? await db.$queryRaw<MicroRow[]>`
        SELECT id, tarefa_id, texto, concluida
        FROM crm_microtarefas
        WHERE tarefa_id = ANY(${tarefasRaw.map((t) => t.id)}::int[])
        ORDER BY ordem ASC, id ASC`
    : [];

  const tarefas = tarefasRaw.map((t) => ({
    ...t,
    microtarefas: micros.filter((m) => m.tarefa_id === t.id),
  }));

  const grupos = [
    { key: "a_fazer",      items: tarefas.filter((t) => t.status === "a_fazer") },
    { key: "em_andamento", items: tarefas.filter((t) => t.status === "em_andamento") },
    { key: "em_revisao",   items: tarefas.filter((t) => t.status === "em_revisao") },
    { key: "concluido",    items: tarefas.filter((t) => t.status === "concluido") },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-900">Tarefas</h2>
        <span className="text-xs text-neutral-400">
          {tarefas.filter((t) => t.status !== "concluido").length} em aberto
        </span>
      </div>

      {tarefas.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-10 text-center">
          <p className="text-sm text-neutral-400">Nenhuma tarefa disponível no momento.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {grupos.map(({ key, items }) => (
            <section key={key}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                {STATUS_LABEL[key]} · {items.length}
              </h3>
              <div className="space-y-3">
                {items.map((t) => {
                  const done     = t.microtarefas.filter((m) => m.concluida).length;
                  const total    = t.microtarefas.length;
                  const concluido = t.status === "concluido";
                  const overdue  = isOverdue(t.data_limite, concluido);

                  return (
                    <div
                      key={t.id}
                      className={`rounded-xl border bg-white p-4 shadow-sm ${
                        concluido ? "border-neutral-100 opacity-70" : "border-neutral-200"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className={`font-medium text-neutral-900 leading-snug ${concluido ? "line-through text-neutral-400" : ""}`}>
                            {t.titulo}
                          </p>

                          {t.descricao && (
                            <p className="mt-1 text-sm text-neutral-500 leading-relaxed">
                              {t.descricao}
                            </p>
                          )}

                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${PRIO_CLS[t.prioridade] ?? ""}`}>
                              {PRIO_LABEL[t.prioridade] ?? t.prioridade}
                            </span>

                            {t.projeto_nome && (
                              <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600">
                                {t.projeto_nome}
                              </span>
                            )}

                            {t.lead_nome && (
                              <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700">
                                {t.lead_nome}
                              </span>
                            )}

                            {t.data_limite && (
                              <span className={`text-xs font-medium ${overdue ? "text-red-500" : "text-neutral-400"}`}>
                                {overdue ? "Atrasada · " : ""}{fmtDate(t.data_limite)}
                              </span>
                            )}

                            {t.responsavel && (
                              <span className="text-xs text-neutral-400">
                                Resp: {t.responsavel}
                              </span>
                            )}
                          </div>
                        </div>

                        {concluido && (
                          <svg className="h-5 w-5 shrink-0 text-emerald-500 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>

                      {/* Sub-tarefas */}
                      {total > 0 && (
                        <div className="mt-3 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-emerald-400 transition-all"
                                style={{ width: `${Math.round((done / total) * 100)}%` }}
                              />
                            </div>
                            <span className="text-[11px] text-neutral-400">{done}/{total}</span>
                          </div>
                          {t.microtarefas.map((m) => (
                            <div key={m.id} className="flex items-center gap-2 pl-1">
                              <span className={`h-3.5 w-3.5 shrink-0 rounded border flex items-center justify-center ${
                                m.concluida ? "border-emerald-500 bg-emerald-500" : "border-neutral-300"
                              }`}>
                                {m.concluida && (
                                  <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </span>
                              <span className={`text-xs ${m.concluida ? "line-through text-neutral-400" : "text-neutral-600"}`}>
                                {m.texto}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
