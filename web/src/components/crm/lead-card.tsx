"use client";

export type Lead = {
  lead_id: string;
  lead_nome: string;
  lead_whatsapp: string;
  fase: string;
  source_app: string | null;
  ad_id: string | null;
  ctwa_clid: string | null;
  gclid: string | null;
  utm_source: string | null;
  webhook_origem: string | null;
  data_criacao: string | null;
  primeira_msg_em: string | null;
  ultima_msg: string | null;
  ultima_msg_tipo: string | null;
  ultima_msg_em: string | null;
};

type Props = {
  lead: Lead;
  isSelected: boolean;
  onClick: () => void;
};

function tempoRelativo(isoStr: string | null): string {
  if (!isoStr) return "";
  const diff = Date.now() - new Date(isoStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

function previewMsg(tipo: string | null, conteudo: string | null): string | null {
  if (!tipo) return null;
  if (tipo === "audio") return "🎵 Áudio";
  if (tipo === "image") return conteudo ? `📷 ${conteudo}` : "📷 Foto";
  if (tipo === "video") return conteudo ? `🎬 ${conteudo}` : "🎬 Vídeo";
  if (tipo === "document") return `📎 ${conteudo ?? "Documento"}`;
  if (tipo === "sticker") return "🎭 Sticker";
  return conteudo ?? null;
}

function dataRelativa(isoStr: string | null): string {
  if (!isoStr) return "";
  // data_criacao é armazenada como UTC midnight — adiciona o offset local
  // para evitar que a data role um dia para trás em UTC-3
  const d = new Date(isoStr);
  const local = new Date(d.getTime() + d.getTimezoneOffset() * 60 * 1000);
  return local.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function OrigemBadge({ lead }: { lead: Lead }) {
  const temGoogle = !!lead.gclid;
  const temMeta   = !!(lead.ad_id || lead.ctwa_clid);
  const isIG      = lead.source_app === "instagram";
  const isFB      = lead.source_app === "facebook" || (temMeta && !isIG);
  const isSite    = lead.utm_source === "site" && !temGoogle && !temMeta && !isIG;

  if (temGoogle) {
    return (
      <span title="Google Ads" className="inline-flex items-center rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] font-bold text-blue-600 ring-1 ring-blue-100">
        G
      </span>
    );
  }
  if (isIG) {
    return (
      <span title="Instagram" className="inline-flex items-center rounded-full bg-pink-50 px-1.5 py-0.5 text-[9px] font-bold text-pink-500 ring-1 ring-pink-100">
        IG
      </span>
    );
  }
  if (isFB) {
    return (
      <span title="Facebook" className="inline-flex items-center rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] font-bold text-blue-500 ring-1 ring-blue-100">
        FB
      </span>
    );
  }
  if (isSite) {
    return (
      <span title="Site" className="inline-flex items-center rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600 ring-1 ring-emerald-100">
        WWW
      </span>
    );
  }
  return (
    <span title="Orgânico" className="inline-flex items-center">
      <svg className="h-3 w-3 text-neutral-300" fill="currentColor" viewBox="0 0 20 20">
        <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
      </svg>
    </span>
  );
}

function WebhookBadge({ origem }: { origem: string | null }) {
  if (origem === "plataforma") {
    return (
      <span title="Recebido pela plataforma Impulso" className="inline-flex items-center rounded-full bg-teal-50 px-1.5 py-0.5 text-[9px] font-bold text-teal-600 ring-1 ring-teal-100">
        P
      </span>
    );
  }
  return (
    <span title="Recebido via n8n (legado)" className="inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-600 ring-1 ring-amber-100">
      N8N
    </span>
  );
}

export function LeadCard({ lead, isSelected, onClick }: Props) {
  const preview = previewMsg(lead.ultima_msg_tipo, lead.ultima_msg);
  const tempo = tempoRelativo(lead.ultima_msg_em);
  const dataCriacao = dataRelativa(lead.data_criacao);

  return (
    <button
      onClick={onClick}
      className={`w-full rounded-xl border p-3 text-left transition-all ${
        isSelected
          ? "border-violet-300 bg-violet-50 shadow-sm"
          : "border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-sm"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-neutral-900">
            {lead.lead_nome || "Sem nome"}
          </p>
          <p className="text-[11px] text-neutral-400">{lead.lead_whatsapp}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {tempo && (
            <span className="text-[10px] text-neutral-400">{tempo}</span>
          )}
          <div className="flex items-center gap-1">
            <WebhookBadge origem={lead.webhook_origem} />
            <OrigemBadge lead={lead} />
          </div>
        </div>
      </div>
      {preview && (
        <p className="mt-1.5 truncate text-[11px] text-neutral-500">{preview}</p>
      )}
      {dataCriacao && (
        <p className={`${preview ? "mt-0.5" : "mt-1.5"} truncate text-[11px] text-neutral-400`}>
          Entrou em {dataCriacao}
        </p>
      )}
    </button>
  );
}
