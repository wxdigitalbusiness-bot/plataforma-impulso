"use client";

type Props = {
  de: "lead" | "atendente";
  tipo: string;
  conteudo: string | null;
  mediaUrl: string | null;
  recebidaEm: Date;
};

function formatHora(d: Date) {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(d));
}

export function MsgBubble({ de, tipo, conteudo, mediaUrl, recebidaEm }: Props) {
  const isAtendente = de === "atendente";

  return (
    <div className={`flex ${isAtendente ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
          isAtendente
            ? "rounded-br-sm bg-violet-600 text-white"
            : "rounded-bl-sm bg-white text-neutral-800 border border-neutral-100"
        }`}
      >
        {tipo === "image" && mediaUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaUrl} alt="imagem" className="mb-1.5 max-h-48 rounded-lg object-cover" />
        )}

        {tipo === "audio" && (
          <p className={`text-xs italic ${isAtendente ? "text-violet-200" : "text-neutral-400"}`}>
            🎵 Mensagem de áudio
          </p>
        )}

        {tipo === "document" && (
          <p className={`text-xs ${isAtendente ? "text-violet-200" : "text-neutral-500"}`}>
            📎 {conteudo ?? "Documento"}
          </p>
        )}

        {tipo === "sticker" && (
          <p className={`text-xs italic ${isAtendente ? "text-violet-200" : "text-neutral-400"}`}>
            🎭 Sticker
          </p>
        )}

        {(tipo === "text" || tipo === "image" || tipo === "video") && conteudo && (
          <p className="whitespace-pre-wrap leading-relaxed">{conteudo}</p>
        )}

        <p className={`mt-1 text-right text-[10px] ${isAtendente ? "text-violet-300" : "text-neutral-400"}`}>
          {formatHora(recebidaEm)}
        </p>
      </div>
    </div>
  );
}
