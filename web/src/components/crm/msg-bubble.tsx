"use client";

type Props = {
  de: "lead" | "atendente";
  tipo: string;
  conteudo: string | null;
  mediaUrl: string | null;
  recebidaEm: Date;
  clienteId: number;
  msgId: string;
};

function formatHora(d: Date) {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(d));
}

export function MsgBubble({ de, tipo, conteudo, recebidaEm, clienteId, msgId }: Props) {
  const isAtendente = de === "atendente";
  const proxyUrl = `/api/crm/${clienteId}/media/${msgId}`;

  const bubbleCls = `max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
    isAtendente
      ? "rounded-br-sm bg-violet-600 text-white"
      : "rounded-bl-sm bg-white text-neutral-800 border border-neutral-100"
  }`;

  const horaCls = `mt-1 text-right text-[10px] ${isAtendente ? "text-violet-300" : "text-neutral-400"}`;

  return (
    <div className={`flex ${isAtendente ? "justify-end" : "justify-start"}`}>
      <div className={bubbleCls}>

        {/* Imagem */}
        {tipo === "image" && (
          <a href={proxyUrl} target="_blank" rel="noopener noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={proxyUrl} alt="imagem" className="mb-1.5 max-h-56 w-auto rounded-lg object-cover" />
          </a>
        )}

        {/* Vídeo */}
        {tipo === "video" && (
          <video controls className="mb-1.5 max-h-56 w-full rounded-lg" preload="metadata">
            <source src={proxyUrl} />
          </video>
        )}

        {/* Áudio */}
        {tipo === "audio" && (
          <audio controls className="mb-1 w-full min-w-[200px]" preload="none" src={proxyUrl} />
        )}

        {/* Documento */}
        {tipo === "document" && (
          <a
            href={proxyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-1.5 text-xs underline ${
              isAtendente ? "text-violet-200 hover:text-white" : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            {conteudo ?? "Documento"}
          </a>
        )}

        {/* Sticker */}
        {tipo === "sticker" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={proxyUrl} alt="sticker" className="mb-1 h-24 w-24 object-contain" />
        )}

        {/* Legenda / texto */}
        {(tipo === "text" || (["image", "video"].includes(tipo) && conteudo)) && conteudo && (
          <p className="whitespace-pre-wrap leading-relaxed">{conteudo}</p>
        )}

        <p className={horaCls}>{formatHora(recebidaEm)}</p>
      </div>
    </div>
  );
}
