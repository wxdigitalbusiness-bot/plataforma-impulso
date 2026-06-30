import { db } from "@/lib/db";
import { LogsTable, WebhookEvent } from "./_table";

export const dynamic = "force-dynamic";

const PER_PAGE = 60;

type Props = {
  searchParams: Promise<{
    instance?: string;
    status?: string;
    q?: string;
    page?: string;
  }>;
};

type EventRow = {
  id: bigint;
  recebido_em: Date;
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

type CountRow = { total: bigint };
type InstanceRow = { instance: string };

export default async function CrmLogsPage({ searchParams }: Props) {
  const sp       = await searchParams;
  const page     = Math.max(1, Number(sp.page ?? "1") || 1);
  const offset   = (page - 1) * PER_PAGE;
  const instance = sp.instance ?? null;
  const status   = sp.status   ?? null;
  const q        = sp.q?.trim() || null;
  const qLike    = q ? `%${q}%` : null;   // padrão para ILIKE

  const [events, countResult, instanceRows] = await Promise.all([
    db.$queryRaw<EventRow[]>`
      SELECT
        id, recebido_em, instance, event_type, status, motivo_skip, raw_body,
        phone, push_name, from_me, ad_id, ctwa_clid, source_app,
        tipo_msg, conteudo, client_key, lead_id, erro_msg
      FROM webhook_events
      WHERE
        (${instance}::text IS NULL OR instance = ${instance})
        AND (${status}::text IS NULL  OR status   = ${status})
        AND (${qLike}::text IS NULL
          OR phone     ILIKE ${qLike}
          OR push_name ILIKE ${qLike}
          OR conteudo  ILIKE ${qLike}
          OR lead_id   ILIKE ${qLike})
      ORDER BY recebido_em DESC
      LIMIT ${PER_PAGE} OFFSET ${offset}
    `,
    db.$queryRaw<CountRow[]>`
      SELECT COUNT(*) AS total FROM webhook_events
      WHERE
        (${instance}::text IS NULL OR instance = ${instance})
        AND (${status}::text IS NULL  OR status   = ${status})
        AND (${qLike}::text IS NULL
          OR phone     ILIKE ${qLike}
          OR push_name ILIKE ${qLike}
          OR conteudo  ILIKE ${qLike}
          OR lead_id   ILIKE ${qLike})
    `,
    db.$queryRaw<InstanceRow[]>`
      SELECT DISTINCT instance FROM webhook_events
      WHERE instance IS NOT NULL
      ORDER BY instance
    `,
  ]);

  const total     = Number((countResult[0] as CountRow)?.total ?? 0);
  const instances = instanceRows.map((r) => r.instance);

  const serialized: WebhookEvent[] = events.map((e) => ({
    id:          e.id.toString(),
    recebido_em: e.recebido_em.toISOString(),
    instance:    e.instance,
    event_type:  e.event_type,
    status:      e.status,
    motivo_skip: e.motivo_skip,
    raw_body:    e.raw_body,
    phone:       e.phone,
    push_name:   e.push_name,
    from_me:     e.from_me,
    ad_id:       e.ad_id,
    ctwa_clid:   e.ctwa_clid,
    source_app:  e.source_app,
    tipo_msg:    e.tipo_msg,
    conteudo:    e.conteudo,
    client_key:  e.client_key,
    lead_id:     e.lead_id,
    erro_msg:    e.erro_msg,
  }));

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center border-b border-neutral-200 bg-white px-6 py-3">
        <div>
          <h1 className="text-base font-semibold text-neutral-900">Logs de Webhooks</h1>
          <p className="text-xs text-neutral-400">
            Todos os eventos recebidos da Evolution API, incluindo ignorados.
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <LogsTable
          events={serialized}
          instances={instances}
          total={total}
          page={page}
          perPage={PER_PAGE}
          currentQ={q ?? ""}
        />
      </div>
    </div>
  );
}
