"use client";

type Lead = {
  lead_id: string;
  lead_nome: string;
  lead_whatsapp: string;
  fase: string;
  source_app: string | null;
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

function previewMsg(tipo: string | null, conteudo: string | null): string {
  if (!tipo) return "Sem mensagens";
  if (tipo === "audio") return "🎵 Áudio";
  if (tipo === "image") return conteudo ? `📷 ${conteudo}` : "📷 Foto";
  if (tipo === "video") return conteudo ? `🎬 ${conteudo}` : "🎬 Vídeo";
  if (tipo === "document") return `📎 ${conteudo ?? "Documento"}`;
  if (tipo === "sticker") return "🎭 Sticker";
  return conteudo ?? "Sem mensagens";
}

export function LeadCard({ lead, isSelected, onClick }: Props) {
  const preview = previewMsg(lead.ultima_msg_tipo, lead.ultima_msg);
  const tempo = tempoRelativo(lead.ultima_msg_em);

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
          {lead.source_app && (
            <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide ${
              lead.source_app === "instagram"
                ? "bg-pink-50 text-pink-500"
                : "bg-blue-50 text-blue-500"
            }`}>
              {lead.source_app === "instagram" ? "IG" : "FB"}
            </span>
          )}
        </div>
      </div>
      {preview && (
        <p className="mt-1.5 truncate text-[11px] text-neutral-500">{preview}</p>
      )}
    </button>
  );
}
