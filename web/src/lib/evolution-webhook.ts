// Parser do payload JSON enviado pela Evolution API nos webhooks de mensagem.
// Extrai os campos relevantes para o CRM: identidade do lead, conteúdo
// da mensagem e dados de atribuição CTWA (Click-to-WhatsApp Advertising).

// O WhatsApp reestruturou os dados de CTWA em algum momento de 2026: o
// ctwaClid saiu de dentro de contextInfo.externalAdReply (que hoje só carrega
// sourceId/title/body/mediaUrl da peça do anúncio) e passou a vir como um blob
// de bytes em contextInfo.ctwaPayload (duplicado em conversionData) — cada
// chave numérica do objeto é um byte, e decodificado como texto dá o próprio
// token do ctwaClid. sourceApp também saiu do externalAdReply e virou
// contextInfo.entryPointConversionApp. Sem esse decode, ~95% das conversas
// vindas de anúncio ficavam sem atribuição (confirmado no cliente FEST PIZZA:
// 123 mensagens com ctwaPayload vs. só 6 leads com ctwa_clid capturado).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function decodeCtwaPayload(payload: any): string | null {
  if (!payload || typeof payload !== "object") return null;
  const bytes = Array.isArray(payload) ? payload : Object.values(payload);
  if (bytes.length === 0 || !bytes.every((b) => typeof b === "number")) return null;
  try {
    const decoded = Buffer.from(bytes as number[]).toString("utf8").trim();
    return decoded || null;
  } catch {
    return null;
  }
}

export type TipoMensagem = "text" | "image" | "audio" | "video" | "document" | "sticker";

export type MensagemParsed = {
  // Identificação
  instance: string;
  evolutionMsgId: string;
  remoteJid: string;       // ex: "556384823503@s.whatsapp.net"
  phone: string;           // apenas os dígitos: "556384823503"
  pushName: string | null;
  fromMe: boolean;         // true = mensagem enviada pelo negócio ao lead

  // Conteúdo
  tipo: TipoMensagem;
  conteudo: string | null; // texto ou legenda
  mediaUrl: string | null;

  // Atribuição Meta CTWA (null se mensagem orgânica)
  adId: string | null;       // externalAdReply.sourceId
  ctwaClid: string | null;   // externalAdReply.ctwaClid
  sourceApp: string | null;  // "instagram" | "facebook"
  adTitle: string | null;    // externalAdReply.title
  adBody: string | null;     // externalAdReply.body
  adMediaUrl: string | null; // externalAdReply.mediaUrl

  // Atribuição Google (reservado — atribuição agora é por janela de tempo no webhook)
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
  if (!key) return null;

  const fromMe: boolean = key.fromMe === true;
  const remoteJid: string = key.remoteJid ?? "";

  // Ignora mensagens de grupos (@g.us) e broadcasts (@broadcast)
  if (remoteJid.endsWith("@g.us") || remoteJid.endsWith("@broadcast")) return null;

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
    mediaUrl = msg.audioMessage.url ?? null;
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
  // Para mensagens do tipo "conversation" (texto simples), o WhatsApp coloca
  // externalAdReply em data.contextInfo — não dentro de message.extendedTextMessage.
  // Para outros tipos (extendedText, image, etc.) está em contextInfo da mensagem.
  const dataContextInfo = data.contextInfo ?? null;
  const externalAdReply =
    contextInfo?.externalAdReply ?? dataContextInfo?.externalAdReply ?? null;
  const ctwaPayloadClid = decodeCtwaPayload(
    dataContextInfo?.ctwaPayload ?? contextInfo?.ctwaPayload
      ?? dataContextInfo?.conversionData ?? contextInfo?.conversionData ?? null,
  );
  const adId: string | null      = externalAdReply?.sourceId  ?? null;
  // ctwaClid: formato antigo dentro de externalAdReply, ou novo formato via ctwaPayload
  const ctwaClid: string | null  = externalAdReply?.ctwaClid  ?? ctwaPayloadClid;
  const sourceApp: string | null = externalAdReply?.sourceApp
    ?? dataContextInfo?.entryPointConversionApp ?? contextInfo?.entryPointConversionApp ?? null;
  const adTitle: string | null   = externalAdReply?.title     ?? null;
  const adBody: string | null    = externalAdReply?.body      ?? null;
  const adMediaUrl: string | null = externalAdReply?.mediaUrl ?? null;

  // Atribuição Google: não lemos mais código da mensagem.
  // O vínculo é feito por janela de tempo no handler do webhook.
  const googleCodeNorm: string | null = null;

  return {
    instance,
    evolutionMsgId,
    remoteJid,
    phone,
    pushName,
    fromMe,
    tipo,
    conteudo,
    mediaUrl,
    adId,
    ctwaClid,
    sourceApp,
    adTitle,
    adBody,
    adMediaUrl,
    googleCode: googleCodeNorm,
    recebidaEm: new Date(messageTimestamp * 1000),
  };
}
