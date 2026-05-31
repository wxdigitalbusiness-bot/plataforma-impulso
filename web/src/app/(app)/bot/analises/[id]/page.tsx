import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEFAULT_SYSTEM_MESSAGE, aplicarDiff } from "@/lib/bot-prompts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatPct(taxa: number | null | undefined): string {
  if (taxa === null || taxa === undefined) return "—";
  return `${(taxa * 100).toFixed(1)}%`;
}

function formatDateBR(d: Date): string {
  return d.toLocaleDateString("pt-BR");
}

const statusBadge: Record<string, { label: string; cls: string }> = {
  pendente: { label: "Pendente", cls: "bg-amber-50 text-amber-700" },
  em_revisao: { label: "Em revisão", cls: "bg-blue-50 text-blue-700" },
  aprovada: { label: "Aprovada", cls: "bg-emerald-50 text-emerald-700" },
  rejeitada: { label: "Rejeitada", cls: "bg-neutral-100 text-neutral-600" },
  aplicada: { label: "Aplicada", cls: "bg-violet-50 text-violet-700" },
};

// ── Tipos do payload do analista ──────────────────────────────────────────────
type Objecao = { tipo?: string; ocorrencias?: number };
type Padrao = {
  padrao?: string;
  hipotese?: string;
  evidencia_conversa_ids?: string[];
  impacto_estimado?: string;
};
type Sugestao = {
  modo?: string;
  tipo_mudanca?: string;
  trecho_atual?: string;
  trecho_novo?: string;
  racional?: string;
  expectativa_impacto_pp?: number;
};
type ExperimentoProposto = {
  nome?: string;
  hipotese?: string;
  modo_alvo?: string;
  variante_a_descricao?: string;
  variante_b_descricao?: string;
  metrica_alvo?: string;
  amostra_minima_por_variante?: number;
};

type AnalisePayload = {
  resumo_executivo?: string;
  amostra_suficiente?: boolean;
  metricas_observadas?: { principais_objecoes?: Objecao[] };
  padroes_que_funcionaram?: Padrao[];
  padroes_que_falharam?: Padrao[];
  sugestoes_de_mudanca?: Sugestao[];
  experimentos_propostos_ab?: ExperimentoProposto[];
  alertas_de_seguranca?: string[];
};

// ── Server Actions ────────────────────────────────────────────────────────────
async function aprovarExperimento(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const analiseId = Number(formData.get("analiseId"));
  const expIndex = Number(formData.get("expIndex"));
  if (Number.isNaN(analiseId) || Number.isNaN(expIndex)) return;

  const analise = await db.botAnaliseSemanal.findUnique({ where: { id: analiseId } });
  if (!analise) return;

  const payload = (analise.payload as unknown) as AnalisePayload;
  const exp = payload.experimentos_propostos_ab?.[expIndex];
  if (!exp) return;

  // Monta variante_b aplicando a sugestão de diff (se houver) sobre o DEFAULT.
  // Se não houver diff específico, B fica igual ao DEFAULT — analista deve sugerir diff
  // claro (trecho_atual + trecho_novo). Procuramos primeiro na sugestao correspondente
  // por índice, depois na primeira sugestão da análise como fallback.
  const sugestao = payload.sugestoes_de_mudanca?.[expIndex]
    ?? payload.sugestoes_de_mudanca?.[0];
  const varianteB = sugestao?.trecho_atual && sugestao?.trecho_novo
    ? aplicarDiff(sugestao.trecho_atual, sugestao.trecho_novo)
    : DEFAULT_SYSTEM_MESSAGE;

  await db.botExperimentoAb.create({
    data: {
      analiseId: analise.id,
      nome: exp.nome ?? `Experimento da semana ${formatDateBR(analise.periodoInicio)}`,
      hipotese: exp.hipotese ?? null,
      modoAlvo: exp.modo_alvo ?? "unico",
      varianteA: DEFAULT_SYSTEM_MESSAGE,
      varianteB,
      metricaAlvo: exp.metrica_alvo ?? "taxa_fechamento",
      amostraMinima: exp.amostra_minima_por_variante ?? 25,
      status: "rodando",
    },
  });

  await db.botAnaliseSemanal.update({
    where: { id: analise.id },
    data: {
      status: "aprovada",
      decididoPor: session.user.email,
      decididoEm: new Date(),
    },
  });

  revalidatePath(`/bot/analises/${analise.id}`);
  revalidatePath("/bot/analises");
  revalidatePath("/bot");
}

async function rejeitarAnalise(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const analiseId = Number(formData.get("analiseId"));
  const nota = String(formData.get("nota") ?? "").trim() || null;
  if (Number.isNaN(analiseId)) return;

  await db.botAnaliseSemanal.update({
    where: { id: analiseId },
    data: {
      status: "rejeitada",
      decididoPor: session.user.email,
      decididoEm: new Date(),
      decisaoNotas: nota,
    },
  });

  revalidatePath(`/bot/analises/${analiseId}`);
  revalidatePath("/bot/analises");
  revalidatePath("/bot");
}

// ── Página ────────────────────────────────────────────────────────────────────
type Props = { params: Promise<{ id: string }> };

export default async function AnaliseDetalhePage({ params }: Props) {
  const { id } = await params;
  const analiseId = Number(id);
  if (Number.isNaN(analiseId)) notFound();

  const analise = await db.botAnaliseSemanal.findUnique({
    where: { id: analiseId },
    include: { experimentos: true },
  });
  if (!analise) notFound();

  const payload = (analise.payload as unknown) as AnalisePayload;
  const status = statusBadge[analise.status] ?? { label: analise.status, cls: "bg-neutral-100" };
  const isPendente = analise.status === "pendente";

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <Link href="/bot/analises" className="text-sm text-neutral-500 hover:text-neutral-700">
          ← Voltar pra lista
        </Link>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Semana {formatDateBR(analise.periodoInicio)} – {formatDateBR(analise.periodoFim)}
            </h1>
            <p className="text-sm text-neutral-500">
              Análise gerada {analise.criadoEm.toLocaleString("pt-BR")}
              {analise.decididoPor && (
                <>
                  {" · "}
                  Decidido por <strong>{analise.decididoPor}</strong> em{" "}
                  {analise.decididoEm?.toLocaleString("pt-BR") ?? "—"}
                </>
              )}
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${status.cls}`}>
            {status.label}
          </span>
        </div>
      </header>

      {/* KPIs */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Kpi label="Conversas" value={String(analise.totalConversas)} />
        <Kpi label="Fechadas" value={String(analise.fechadas)} tone="ok" />
        <Kpi label="Em aberto" value={String(analise.emAberto)} />
        <Kpi label="Perdidas" value={String(analise.perdidas)} />
        <Kpi
          label="Taxa fechamento"
          value={analise.taxaFechamento ? formatPct(Number(analise.taxaFechamento)) : "—"}
        />
      </section>

      {/* Aviso amostra pequena */}
      {payload.amostra_suficiente === false && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <strong>⚠ Amostra pequena.</strong> O analista marcou que ainda não há dados
          suficientes pra conclusões fortes. Sugestões podem ser ignoradas com baixa perda.
        </div>
      )}

      {/* Resumo executivo */}
      {analise.resumoExecutivo && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-neutral-700">Resumo executivo</h2>
          <div className="rounded-xl border border-neutral-200 bg-white p-5 text-sm leading-relaxed text-neutral-800">
            {analise.resumoExecutivo}
          </div>
        </section>
      )}

      {/* Padrões que funcionaram */}
      {payload.padroes_que_funcionaram && payload.padroes_que_funcionaram.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-emerald-700">✅ Padrões que funcionaram</h2>
          <ul className="space-y-2">
            {payload.padroes_que_funcionaram.map((p, i) => (
              <li key={i} className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-4 text-sm">
                <p className="text-neutral-900">{p.padrao ?? "—"}</p>
                {p.evidencia_conversa_ids && p.evidencia_conversa_ids.length > 0 && (
                  <p className="mt-1 text-xs text-neutral-500">
                    Evidência: {p.evidencia_conversa_ids.join(", ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Padrões que falharam */}
      {payload.padroes_que_falharam && payload.padroes_que_falharam.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-red-700">⚠ Padrões que falharam</h2>
          <ul className="space-y-2">
            {payload.padroes_que_falharam.map((p, i) => (
              <li key={i} className="rounded-xl border border-red-100 bg-red-50/30 p-4 text-sm">
                <p className="text-neutral-900">{p.padrao ?? "—"}</p>
                {p.hipotese && (
                  <p className="mt-1 text-xs text-neutral-600">
                    <strong>Hipótese:</strong> {p.hipotese}
                  </p>
                )}
                {p.evidencia_conversa_ids && p.evidencia_conversa_ids.length > 0 && (
                  <p className="mt-1 text-xs text-neutral-500">
                    Evidência: {p.evidencia_conversa_ids.join(", ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Sugestões de mudança */}
      {payload.sugestoes_de_mudanca && payload.sugestoes_de_mudanca.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-neutral-700">💡 Sugestões de mudança</h2>
          <ul className="space-y-3">
            {payload.sugestoes_de_mudanca.map((s, i) => (
              <li key={i} className="rounded-xl border border-neutral-200 bg-white p-5">
                <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-neutral-500">
                  <span className="rounded bg-neutral-100 px-2 py-0.5">{s.tipo_mudanca ?? "—"}</span>
                  <span>modo: {s.modo ?? "unico"}</span>
                  {s.expectativa_impacto_pp !== undefined && (
                    <span className="text-emerald-700">+{s.expectativa_impacto_pp}pp esperado</span>
                  )}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-[10px] uppercase text-neutral-500">Trecho atual</p>
                    <p className="mt-1 whitespace-pre-wrap rounded-lg bg-neutral-50 p-3 text-sm text-neutral-700">
                      {s.trecho_atual ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-neutral-500">Trecho novo proposto</p>
                    <p className="mt-1 whitespace-pre-wrap rounded-lg bg-emerald-50/50 p-3 text-sm text-neutral-700">
                      {s.trecho_novo ?? "—"}
                    </p>
                  </div>
                </div>
                {s.racional && (
                  <p className="mt-3 text-xs text-neutral-600">
                    <strong>Racional:</strong> {s.racional}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Experimentos A/B propostos — botões de aprovação */}
      {payload.experimentos_propostos_ab && payload.experimentos_propostos_ab.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-neutral-700">🧪 Experimentos A/B propostos</h2>
          {isPendente && (
            <p className="mb-3 text-xs text-neutral-500">
              Ao aprovar, um experimento é criado em <code>bot_experimentos_ab</code> com status{" "}
              <strong>rodando</strong>. Ele só passa a rotear leads quando a v4 do bot for publicada.
            </p>
          )}
          <ul className="space-y-3">
            {payload.experimentos_propostos_ab.map((e, i) => (
              <li key={i} className="rounded-xl border border-neutral-200 bg-white p-5">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-neutral-900">{e.nome ?? "(sem nome)"}</p>
                  <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700">
                    métrica alvo: {e.metrica_alvo ?? "—"}
                  </span>
                </div>
                {e.hipotese && (
                  <p className="text-xs text-neutral-600">
                    <strong>Hipótese:</strong> {e.hipotese}
                  </p>
                )}
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg bg-neutral-50 p-3 text-sm">
                    <p className="text-[10px] uppercase text-neutral-500">Variante A (controle)</p>
                    <p className="mt-1 text-neutral-700">{e.variante_a_descricao ?? "—"}</p>
                  </div>
                  <div className="rounded-lg bg-emerald-50/50 p-3 text-sm">
                    <p className="text-[10px] uppercase text-emerald-700">Variante B (novo)</p>
                    <p className="mt-1 text-neutral-700">{e.variante_b_descricao ?? "—"}</p>
                  </div>
                </div>
                <p className="mt-2 text-[10px] uppercase text-neutral-500">
                  amostra mínima por variante: {e.amostra_minima_por_variante ?? 20}
                </p>

                {isPendente && (
                  <form action={aprovarExperimento} className="mt-4">
                    <input type="hidden" name="analiseId" value={analise.id} />
                    <input type="hidden" name="expIndex" value={i} />
                    <button
                      type="submit"
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                    >
                      ✓ Aprovar este experimento
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Alertas de segurança */}
      {payload.alertas_de_seguranca && payload.alertas_de_seguranca.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-red-700">🔐 Alertas de segurança</h2>
          <ul className="space-y-2">
            {payload.alertas_de_seguranca.map((a, i) => (
              <li key={i} className="rounded-xl border border-red-200 bg-red-50/50 p-4 text-sm text-red-800">
                {a}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Botão rejeitar (sempre disponível enquanto pendente) */}
      {isPendente && (
        <section className="rounded-xl border border-neutral-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-neutral-700">Rejeitar análise</h3>
          <p className="mt-1 text-xs text-neutral-500">
            Marca esta análise como rejeitada sem criar experimentos. Pode adicionar uma nota explicando.
          </p>
          <form action={rejeitarAnalise} className="mt-3 space-y-2">
            <input type="hidden" name="analiseId" value={analise.id} />
            <textarea
              name="nota"
              rows={2}
              placeholder="Motivo da rejeição (opcional)…"
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              ✗ Rejeitar
            </button>
          </form>
        </section>
      )}

      {/* Decisão */}
      {!isPendente && analise.decisaoNotas && (
        <section className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm">
          <p className="text-xs uppercase text-neutral-500">Nota de decisão</p>
          <p className="mt-1 text-neutral-700">{analise.decisaoNotas}</p>
        </section>
      )}

      {/* Experimentos criados a partir desta análise */}
      {analise.experimentos.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-neutral-700">
            Experimentos criados a partir desta análise
          </h2>
          <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
            {analise.experimentos.map((e) => (
              <li key={e.id} className="px-5 py-3 text-sm">
                <Link href={`/bot/experimentos/${e.id}`} className="font-medium text-neutral-900 hover:underline">
                  {e.nome}
                </Link>
                <p className="text-xs text-neutral-500">
                  status: <strong>{e.status}</strong> · iniciado {e.dataInicio.toLocaleDateString("pt-BR")}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "ok";
}) {
  const toneClass = tone === "ok" ? "text-emerald-700" : "text-neutral-900";
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}
