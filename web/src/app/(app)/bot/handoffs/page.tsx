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

const motivosLabel: Record<string, string> = {
  fechamento_pagamento: "💰 Fechamento (pagamento)",
  credenciais: "🔐 Credenciais enviadas",
  pedido_explicito: "🙋 Pediu humano",
  reclamacao: "😡 Reclamação",
  fora_do_escopo: "❓ Fora do escopo",
  humano_assumiu: "👤 Humano respondeu",
  manual: "🛠 Pausado manual",
};

async function reativarLead(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const phone = String(formData.get("phone") ?? "").trim();
  if (!phone) return;

  await db.conversaHandoff.update({
    where: { phone },
    data: {
      handoffActive: false,
      reativadoEm: new Date(),
    },
  });

  revalidatePath("/bot/handoffs");
  revalidatePath("/bot");
}

export default async function HandoffsPage() {
  const handoffs = await db.conversaHandoff.findMany({
    where: { handoffActive: true },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Handoffs ativos</h1>
          <p className="text-sm text-neutral-500">
            Conversas que o bot transferiu pro humano. O bot fica silencioso nestas conversas até reativar.
          </p>
        </div>
        <Link href="/bot" className="text-sm text-neutral-500 hover:text-neutral-700">
          ← Voltar pro bot
        </Link>
      </header>

      <div className="rounded-xl border border-neutral-200 bg-white">
        {handoffs.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-neutral-500">
            Nenhuma conversa em handoff. O bot está respondendo a todas. 🙌
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-5 py-3 text-left">Telefone</th>
                <th className="px-5 py-3 text-left">Motivo</th>
                <th className="px-5 py-3 text-left">Travado</th>
                <th className="px-5 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {handoffs.map((h) => (
                <tr key={h.phone} className="hover:bg-neutral-50">
                  <td className="px-5 py-3">
                    <p className="font-mono text-sm text-neutral-900">{h.phone}</p>
                  </td>
                  <td className="px-5 py-3 text-sm text-neutral-700">
                    {motivosLabel[h.motivo ?? ""] ?? h.motivo ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-xs text-neutral-500">{tempoRelativo(h.updatedAt)}</td>
                  <td className="px-5 py-3 text-right">
                    <form action={reativarLead}>
                      <input type="hidden" name="phone" value={h.phone} />
                      <button
                        type="submit"
                        className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                      >
                        ↻ Reativar bot
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-neutral-400">
        Reativar libera o bot pra responder esta conversa de novo. Use quando o atendimento humano terminou.
      </p>
    </div>
  );
}
