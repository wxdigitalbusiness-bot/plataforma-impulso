// Parser do payload JSON enviado pela Evolution API nos webhooks de mensagem.
// Extrai os campos relevantes para o CRM: identidade do lead, conteúdo
// da mensagem e dados de atribuição CTWA (Click-to-WhatsApp Advertising).

export type TipoMensagem = "text" | "image" | "audio" | "video" | "document" | "sticker";

export type MensagemParsed = {
  // Identificação
  instance: string;
  evolutionMsgId: string;
  remoteJid: string;       // ex: "556384823503@s.whatsapp.net"
  phone: string;           // apenas os dígitos: "556384823503"
  pushName: string | null;

  // Conteúdo
  tipo: TipoMensagem;
  conteudo: string | null; // texto ou legenda
  mediaUrl: string | null;

  // Atribuição Meta CTWA (null se mensagem orgânica)
  adId: string | null;       // externalAdReply.sourceId
  ctwaClid: string | null;   // externalAdReply.ctwaClid
  sourceApp: string | null;  // "instagram" | "facebook"

  // Atribuição Google (código GG-xxxxxx extraído da mensagem)
  googleCode: string | null;

  // Timestamp (Unix seconds → Date)
  recebidaEm: Date;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseEvolutionWebhook(body: any): MensagemParsed | null {
  // Só processa eventos de mensagem
  if (body?.event !== "messages.upsert") return null;

  const data = body?.data;
  if (!data) return null;

  const key = data.key;
  // Ignora mensagens enviadas pelo próprio número (fromMe)
  if (!key || key.fromMe) return null;

  const remoteJid: string = key.remoteJid ?? "";
  const phone = remoteJid.replace(/@.*$/, "");
  const instance: string = body.instance ?? "";
  const evolutionMsgId: string = key.id ?? "";
  const pushName: string | null = data.pushName ?? null;
  const messageTimestamp: number = data.messageTimestamp ?? Math.floor(Date.now() / 1000);

  const msg = data.message ?? {};

  // Detecta o tipo e extrai conteúdo + contextInfo
  let tipo: TipoMensagem = "text";
  let conteudo: string | null = null;
  let mediaUrl: string | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let contextInfo: any = null;

  if (msg.conversation !== undefined) {
    tipo = "text";
    conteudo = msg.conversation ?? null;
    contextInfo = msg.extendedTextMessage?.contextInfo ?? null;
  } else if (msg.extendedTextMessage) {
    tipo = "text";
    conteudo = msg.extendedTextMessage.text ?? null;
    contextInfo = msg.extendedTextMessage.contextInfo ?? null;
  } else if (msg.imageMessage) {
    tipo = "image";
    conteudo = msg.imageMessage.caption ?? null;
    mediaUrl = msg.imageMessage.url ?? null;
    contextInfo = msg.imageMessage.contextInfo ?? null;
  } else if (msg.audioMessage) {
    tipo = "audio";
    contextInfo = msg.audioMessage.contextInfo ?? null;
  } else if (msg.videoMessage) {
    tipo = "video";
    conteudo = msg.videoMessage.caption ?? null;
    mediaUrl = msg.videoMessage.url ?? null;
    contextInfo = msg.videoMessage.contextInfo ?? null;
  } else if (msg.documentMessage) {
    tipo = "document";
    conteudo = msg.documentMessage.fileName ?? null;
    mediaUrl = msg.documentMessage.url ?? null;
    contextInfo = msg.documentMessage.contextInfo ?? null;
  } else if (msg.stickerMessage) {
    tipo = "sticker";
    contextInfo = msg.stickerMessage.contextInfo ?? null;
  }

  // Atribuição CTWA (Meta)
  const externalAdReply = contextInfo?.externalAdReply ?? null;
  const adId: string | null = externalAdReply?.sourceId ?? null;
  const ctwaClid: string | null = externalAdReply?.ctwaClid ?? null;
  const sourceApp: string | null = externalAdReply?.sourceApp ?? null;

  // Atribuição Google: suporta "GG-xxxxxx" (legado) e "Protocolo: xxxxxx" (novo)
  // O código no banco é sempre "GG-" + lowercase (ex: GG-8ya6dt) — preservamos esse formato.
  let googleCodeNorm: string | null = null;
  if (conteudo) {
    const legado   = conteudo.match(/GG-([a-z0-9]+)/i);
    const protocolo = conteudo.match(/Protocolo:\s*([a-z0-9]+)/i);
    const raw = legado?.[1] ?? protocolo?.[1] ?? null;
    if (raw) googleCodeNorm = `GG-${raw.toLowerCase()}`;
  }

  return {
    instance,
    evolutionMsgId,
    remoteJid,
    phone,
    pushName,
    tipo,
    conteudo,
    mediaUrl,
    adId,
    ctwaClid,
    sourceApp,
    googleCode: googleCodeNorm,
    recebidaEm: new Date(messageTimestamp * 1000),
  };
}
