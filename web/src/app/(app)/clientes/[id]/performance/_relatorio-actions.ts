"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { calcularPeriodo, gerarToken, type TipoRelatorio } from "@/lib/relatorios";
import { gerarSnapshotMeta } from "@/lib/meta-snapshot";

const schema = z.object({
  clienteId: z.coerce.number().int().positive(),
  tipo: z.enum(["semanal", "quinzenal", "mensal"]),
  mesAno: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

export type CriarRelatorioResult =
  | { ok: true; token: string; tipo: TipoRelatorio; from: string; to: string }
  | { ok: false; erro: string };

export async function criarRelatorioPublico(
  input: { clienteId: number; tipo: TipoRelatorio; mesAno?: string },
): Promise<CriarRelatorioResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, erro: "Parâmetros inválidos." };

  const session = await auth();
  if (!session?.user?.email) return { ok: false, erro: "Não autenticado." };

  const cliente = await db.cliente.findUnique({
    where: { id: parsed.data.clienteId },
    include: {
      contas: {
        where: { ativo: true },
        select: { metaAdAccountId: true },
      },
    },
  });
  if (!cliente) return { ok: false, erro: "Cliente não encontrado." };

  const periodo = calcularPeriodo(parsed.data.tipo, parsed.data.mesAno);
  const token   = gerarToken();

  // Fetch ao vivo da Meta — usa as contas Meta vinculadas ao cliente.
  // Roda em parallel se houver múltiplas contas (gerarSnapshotMeta itera por dentro).
  const adAccountIds = cliente.contas
    .map((c) => c.metaAdAccountId)
    .filter((id): id is string => !!id && id.trim() !== "");

  let snapshot: object | null = null;
  if (adAccountIds.length > 0) {
    const token_meta = process.env.META_ACCESS_TOKEN;
    if (!token_meta) {
      return { ok: false, erro: "META_ACCESS_TOKEN ausente no servidor." };
    }
    try {
      snapshot = await gerarSnapshotMeta(adAccountIds, periodo.from, periodo.to, token_meta);
    } catch (err) {
      console.error("[criarRelatorioPublico] snapshot meta:", err);
      return {
        ok: false,
        erro: `Erro ao buscar dados Meta: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  await db.relatorioPublico.create({
    data: {
      token,
      clienteId: cliente.id,
      tipo:      parsed.data.tipo,
      dateFrom:  new Date(periodo.from + "T00:00:00Z"),
      dateTo:    new Date(periodo.to   + "T00:00:00Z"),
      criadoPor: session.user.email,
      snapshot:  snapshot as never,
    },
  });

  return {
    ok:    true,
    token,
    tipo:  parsed.data.tipo,
    from:  periodo.from,
    to:    periodo.to,
  };
}
