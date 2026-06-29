"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

export type WebhookEvent = {
  id: string;
  recebido_em: string;
  instance: string | null;
  event_type: string | null;
  status: string;
  motivo_skip: string | null;
  raw_body: unknown;
  phone: string | null;
  push_name: string | null;
  from_me: boolean | null;
  ad_id: string | null;
  ctwa_clid: string | null;
  source_app: string | null;
  tipo_msg: string | null;
  conteudo: string | null;
  client_key: string | null;
  lead_id: string | null;
  erro_msg: string | null;
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  processado: { label: "Processado",  cls: "bg-green-100 text-green-700" },
  fromMe:     { label: "Enviado",     cls: "bg-blue-100 text-blue-700" },
  ignorado:   { label: "Ignorado",    cls: "bg-yellow-100 text-yellow-700" },
  erro:       { label: "Erro",        cls: "bg-red-100 text-red-700" },
};

const MOTIVO_LABEL: Record<string, string> = {
  parse_null:          "Evento ignorado pelo parser",
  json_parse_error:    "JSON inválido",
  instance_not_mapped: "Instância não mapeada",
};

function StatusBadge({ status }: { status: string }) {
  const b = STATUS_BADGE[status] ?? { label: status, cls: "bg-neutral-100 text-neutral-600" };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${b.cls}`}>
      {b.label}
    </span>
  );
}

function Row({ ev }: { ev: WebhookEvent }) {
  const [open, setOpen] = useState(false);

  const hora = new Date(ev.recebido_em).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    timeZone: "America/Sao_Paulo",
  });

  const temAnuncio = !!(ev.ad_id || ev.ctwa_clid);
  const origem = ev.source_app === "instagram" ? "IG" : temAnuncio ? "FB" : null;

  return (
    <>
      <tr
        className="cursor-pointer border-b border-neutral-100 hover:bg-neutral-50 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <td className="whitespace-nowrap px-3 py-2 text-xs text-neutral-500">{hora}</td>
        <td className="px-3 py-2 text-xs font-mono text-neutral-600">{ev.instance ?? "—"}</td>
        <td className="px-3 py-2"><StatusBadge status={ev.status} /></td>
        <td className="px-3 py-2 text-xs text-neutral-700">
          {ev.phone ? ev.phone.replace(/^55/, "") : "—"}
        </td>
        <td className="px-3 py-2 text-xs text-neutral-700 max-w-[140px] truncate">
          {ev.push_name ?? <span className="text-neutral-400">—</span>}
        </td>
        <td className="px-3 py-2 text-xs text-neutral-500">
          {ev.from_me === true ? "Negócio" : ev.from_me === false ? "Lead" : "—"}
        </td>
        <td className="px-3 py-2 text-xs">
          {temAnuncio ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
              {origem}
            </span>
          ) : (
            <span className="text-neutral-400">—</span>
          )}
        </td>
        <td className="px-3 py-2 text-xs text-neutral-500">{ev.tipo_msg ?? "—"}</td>
        <td className="px-3 py-2 text-xs text-neutral-600 max-w-[200px] truncate">
          {ev.conteudo ?? ev.motivo_skip
            ? (ev.conteudo ?? MOTIVO_LABEL[ev.motivo_skip ?? ""] ?? ev.motivo_skip)
            : <span className="text-neutral-400">—</span>}
        </td>
        <td className="px-3 py-2 text-right text-xs text-neutral-400">
          {open ? "▲" : "▼"}
        </td>
      </tr>
      {open && (
        <tr className="border-b border-neutral-200 bg-neutral-50">
          <td colSpan={10} className="px-4 py-3">
            {ev.erro_msg && (
              <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                Erro: {ev.erro_msg}
              </p>
            )}
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 mb-3 text-xs text-neutral-600">
              {ev.client_key && <span><b>Client key:</b> {ev.client_key}</span>}
              {ev.lead_id    && <span><b>Lead ID:</b> {ev.lead_id}</span>}
              {ev.ad_id      && <span><b>Ad ID:</b> {ev.ad_id}</span>}
              {ev.ctwa_clid  && <span><b>CTWA CLID:</b> {ev.ctwa_clid}</span>}
            </div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
              Payload completo
            </p>
            <pre className="max-h-64 overflow-auto rounded-lg bg-neutral-900 p-3 text-[11px] leading-relaxed text-green-300">
              {JSON.stringify(ev.raw_body, null, 2)}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}

export function LogsTable({
  events,
  instances,
  total,
  page,
  perPage,
  currentQ,
}: {
  events: WebhookEvent[];
  instances: string[];
  total: number;
  page: number;
  perPage: number;
  currentQ: string;
}) {
  const router    = useRouter();
  const pathname  = usePathname();
  const sp        = useSearchParams();
  const [, start] = useTransition();

  // Campo de busca com debounce para não navegar a cada tecla
  const [searchInput, setSearchInput] = useState(currentQ);

  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = searchInput.trim();
      const current = sp.get("q") ?? "";
      if (trimmed === current) return;
      navigate({ q: trimmed || null, page: "1" });
    }, 400);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  // Sincroniza se a URL mudar externamente (ex: limpeza do filtro)
  useEffect(() => { setSearchInput(currentQ); }, [currentQ]);

  function navigate(params: Record<string, string | null>) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(params)) {
      if (v == null) next.delete(k);
      else next.set(k, v);
    }
    start(() => router.replace(`${pathname}?${next.toString()}`));
  }

  const currentInstance = sp.get("instance") ?? "";
  const currentStatus   = sp.get("status")   ?? "";
  const totalPages      = Math.ceil(total / perPage);

  return (
    <div className="flex flex-col h-full">
      {/* Filtros */}
      <div className="flex shrink-0 items-center gap-3 border-b border-neutral-200 bg-white px-4 py-2.5">
        <span className="text-xs font-medium text-neutral-500">Filtrar:</span>

        {/* Campo de pesquisa */}
        <div className="relative">
          <svg className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Telefone, nome, mensagem…"
            className="rounded-lg border border-neutral-200 bg-white pl-8 pr-3 py-1.5 text-xs text-neutral-700 outline-none focus:border-violet-400 w-52"
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
            >
              ×
            </button>
          )}
        </div>

        <select
          value={currentInstance}
          onChange={(e) => navigate({ instance: e.target.value || null, page: "1" })}
          className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700 outline-none focus:border-violet-400"
        >
          <option value="">Todas as instâncias</option>
          {instances.map((i) => (
            <option key={i} value={i}>{i}</option>
          ))}
        </select>

        <select
          value={currentStatus}
          onChange={(e) => navigate({ status: e.target.value || null, page: "1" })}
          className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700 outline-none focus:border-violet-400"
        >
          <option value="">Todos os status</option>
          <option value="processado">Processado</option>
          <option value="fromMe">Enviado (fromMe)</option>
          <option value="ignorado">Ignorado</option>
          <option value="erro">Erro</option>
        </select>

        <span className="ml-auto text-xs text-neutral-400">
          {total.toLocaleString("pt-BR")} evento{total !== 1 ? "s" : ""}
        </span>

        <button
          onClick={() => router.refresh()}
          className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50 transition-colors"
        >
          Atualizar
        </button>
      </div>

      {/* Tabela */}
      <div className="flex-1 overflow-auto">
        {events.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-neutral-400">
            Nenhum evento encontrado.
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="sticky top-0 z-10 border-b border-neutral-200 bg-neutral-50">
              <tr>
                <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Hora</th>
                <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Instância</th>
                <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Status</th>
                <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Telefone</th>
                <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Nome</th>
                <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">De</th>
                <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Anúncio</th>
                <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Tipo</th>
                <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Conteúdo</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <Row key={ev.id} ev={ev} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex shrink-0 items-center justify-between border-t border-neutral-200 bg-white px-4 py-2.5">
          <button
            disabled={page <= 1}
            onClick={() => navigate({ page: String(page - 1) })}
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50 disabled:opacity-40 transition-colors"
          >
            ← Anterior
          </button>
          <span className="text-xs text-neutral-500">
            Página {page} de {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => navigate({ page: String(page + 1) })}
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50 disabled:opacity-40 transition-colors"
          >
            Próxima →
          </button>
        </div>
      )}
    </div>
  );
}
