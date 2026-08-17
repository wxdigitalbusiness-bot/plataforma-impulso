// Página de Panfletagem Digital — métricas de alcance, visualizações,
// visitas ao perfil, seguidores ganhos e conversas via Meta Ads.

import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { defaultRange } from "@/lib/performance";
import { DateFilter } from "@/app/(app)/_date-filter";
import {
  getPanfletagemInsights,
} from "@/lib/db-insights";
import { PanfletagemResumo } from "@/components/panfletagem/resumo";
import { GerarRelatorioButton } from "../performance/_gerar-relatorio";
import { listarMesesRecentes, mesAtualEmCurso } from "@/lib/relatorios";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatDateBR(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function isValidIso(s: string | undefined): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
};

export default async function PanfletagemPage({ params, searchParams }: Props) {
  const { id } = await params;
  const clienteId = Number(id);
  if (Number.isNaN(clienteId)) notFound();

  const sp = await searchParams;
  const def = defaultRange();
  const from = isValidIso(sp.from) ? sp.from : def.from;
  const to   = isValidIso(sp.to)   ? sp.to   : def.to;

  const cliente = await db.cliente.findUnique({
    where: { id: clienteId },
    select: {
      id: true,
      nome: true,
      empresa: true,
      tipoServico: true,
      n8nClientKey: true,
    },
  });
  if (!cliente) notFound();
  if (cliente.tipoServico !== "panfletagem_digital") notFound();

  const clientKey = cliente.n8nClientKey ?? "";

  const dados = clientKey
    ? await getPanfletagemInsights(clientKey, from, to)
    : null;

  return (
    <div className="space-y-8">
      {/* Breadcrumb + cabeçalho */}
      <header>
        <nav className="mb-1 flex items-center gap-1.5 text-xs text-neutral-400">
          <Link href="/" className="hover:text-neutral-600">Dashboard</Link>
          <span>/</span>
          <Link href="/clientes" className="hover:text-neutral-600">Clientes</Link>
          <span>/</span>
          <Link href={`/clientes/${clienteId}`} className="hover:text-neutral-600">
            {cliente.nome}
          </Link>
          <span>/</span>
          <span className="text-neutral-700">Panfletagem</span>
        </nav>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{cliente.nome}</h1>
            {cliente.empresa && (
              <p className="text-sm text-neutral-500">{cliente.empresa}</p>
            )}
            <p className="mt-0.5 text-xs text-neutral-400">
              Panfletagem Digital — {formatDateBR(from)} a {formatDateBR(to)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <DateFilter from={from} to={to} basePath={`/clientes/${clienteId}/panfletagem`} />
            <GerarRelatorioButton
              clienteId={clienteId}
              meses={listarMesesRecentes(12).filter((m) => m.value !== mesAtualEmCurso())}
              defaultMesAno={listarMesesRecentes(2).filter((m) => m.value !== mesAtualEmCurso())[0]?.value ?? ""}
            />
            <Link
              href={`/clientes/${clienteId}`}
              className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              ⚙ Gerenciar contas
            </Link>
          </div>
        </div>
      </header>

      {/* ── Métricas de Panfletagem ───────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-sky-500" />
          <h2 className="text-sm font-semibold text-neutral-700">Panfletagem Digital</h2>
          <span className="text-xs text-neutral-400">Visualizações, alcance e conversas no período</span>
        </div>

        {dados ? (
          <PanfletagemResumo dados={dados} seguidores={null} />
        ) : (
          <div className="rounded-xl border border-neutral-200 bg-white px-6 py-12 text-center text-sm text-neutral-500">
            Nenhuma chave n8n configurada para este cliente.{" "}
            <Link
              href={`/clientes/${clienteId}/editar`}
              className="font-medium text-neutral-700 underline"
            >
              Configurar chave
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
