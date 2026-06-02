import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function tempoRelativo(d: Date | null | undefined): string {
  if (!d) return "—";
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `há ${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.round(h / 24)}d`;
}

// ── Server Actions ──────────────────────────────────────────────────────────
async function confirmarVenda(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const phone = String(formData.get("phone") ?? "").trim();
  if (!phone) return;

  await db.botConversa.update({
    where: { phone },
    data: {
      resultado: "ganho",
      fechadoEm: new Date(),
      metadata: { confirmadoPor: session.user.email, confirmadoEm: new Date().toISOString() },
    },
  });

  revalidatePath("/bot/fechamentos");
  revalidatePath("/bot");
}

async function marcarNaoFechou(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const phone = String(formData.get("phone") ?? "").trim();
  if (!phone) return;

  // resultado=perdido, conversa permanece em handoff (não reativa o bot)
  await db.botConversa.update({
    where: { phone },
    data: {
      resultado: "perdido",
      motivoPerda: "nao_fechou",
      perdidoEm: new Date(),
      metadata: { confirmadoPor: session.user.email, confirmadoEm: new Date().toISOString() },
    },
  });

  revalidatePath("/bot/fechamentos");
  revalidatePath("/bot");
}

// ── Página ──────────────────────────────────────────────────────────────────
export default async function FechamentosPage() {
  // Conversas que o lead disse SIM mas aguardam confirmação humana de venda
  const pendentes = await db.botConversa.findMany({
    where: { resultado: "pendente_confirmacao" },
    orderBy: { ultimaMsgEm: "desc" },
  });

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Fechamentos a confirmar</h1>
          <p className="text-sm text-neutral-500">
            Leads que disseram SIM pelo bot. Confirme se a venda foi concretizada antes de contar como fechada.
          </p>
        </div>
        <Link href="/bot" className="text-sm text-neutral-500 hover:text-neutral-700">
          ← Voltar pro bot
        </Link>
      </header>

      <div className="rounded-xl border border-neutral-200 bg-white">
        {pendentes.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-neutral-500">
            Nenhum fechamento aguardando confirmação. 🙌
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {pendentes.map((c) => (
              <li key={c.phone} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-neutral-900">
                    {c.pushName ?? "Lead"}{" "}
                    <span className="font-mono text-xs text-neutral-500">({c.phone})</span>
                  </p>
                  <p className="text-xs text-neutral-500">
                    Disse SIM {tempoRelativo(c.ultimaMsgEm)} · primeira msg{" "}
                    {tempoRelativo(c.primeiraMsgEm)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <form action={confirmarVenda}>
                    <input type="hidden" name="phone" value={c.phone} />
                    <button
                      type="submit"
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700"
                    >
                      ✓ Confirmar venda
                    </button>
                  </form>
                  <form action={marcarNaoFechou}>
                    <input type="hidden" name="phone" value={c.phone} />
                    <button
                      type="submit"
                      className="rounded-lg border border-neutral-200 px-4 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                    >
                      ✗ Não fechou
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-neutral-400">
        <strong>Confirmar venda</strong> → conta como fechada nas métricas (resultado: ganho).{" "}
        <strong>Não fechou</strong> → marca como perdida e a conversa continua em handoff
        (bot não volta automaticamente — reative em /bot/handoffs se quiser).
      </p>
    </div>
  );
}
