// Alerta via WhatsApp quando um cron interno quebra ou falha parcialmente.
// Mesmo padrão de envio usado em sync-saldos.ts (Evolution API).

import { EVOLUTION_API_URL, evoHeaders } from "@/lib/whatsapp-sessions";

const ALERT_INSTANCE  = process.env.ALERT_EVOLUTION_INSTANCE ?? "Impulso";
// ponytail: número fixo em vez de config por usuário — só uma agência usa essa plataforma
// Formato sem o "9" extra — jid real desse DDD na Evolution é 556384386017, não 5563984386017
const ALERT_WHATSAPP  = process.env.CRON_ALERT_WHATSAPP ?? "556384386017";

export async function enviarWhatsapp(texto: string) {
  await enviarWhatsappPara(ALERT_WHATSAPP, texto);
}

/**
 * Envia WhatsApp pra um número arbitrário (ex.: cliente), usando a mesma
 * instância Evolution da agência. Diferente de enviarWhatsapp() — que só
 * manda pro número fixo da agência — essa é genérica e devolve se deu certo,
 * pra quem chama poder mostrar erro em vez de falhar silenciosamente.
 */
export async function enviarWhatsappPara(telefone: string, texto: string): Promise<boolean> {
  if (!EVOLUTION_API_URL) return false;
  try {
    const jid = telefone.includes("@") ? telefone : `${telefone}@s.whatsapp.net`;
    const res = await fetch(
      `${EVOLUTION_API_URL}/message/sendText/${encodeURIComponent(ALERT_INSTANCE)}`,
      {
        method: "POST",
        headers: { ...evoHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ number: jid, text: texto }),
      },
    );
    if (!res.ok) {
      console.error("[WHATSAPP] Evolution respondeu", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("[WHATSAPP] falha ao enviar:", err);
    return false;
  }
}

/** Cron lançou exceção antes de terminar (ex: token ausente/expirado). */
export async function alertarCronQuebrado(nomeCron: string, erro: unknown): Promise<void> {
  const msg = erro instanceof Error ? erro.message : String(erro);
  await enviarWhatsapp(
    `🚨 *Cron quebrado: ${nomeCron}*\n\n${msg}\n\nO job não terminou. Verifique os logs do servidor.`,
  );
}

/** Cron rodou até o fim, mas um ou mais clientes falharam dentro dele. */
export async function alertarFalhasCron(
  nomeCron: string,
  resultado: { total: number; sucesso: number; falhou: number; erros?: { cliente: string; erro: string }[] },
): Promise<void> {
  if (resultado.falhou === 0) return;

  const cabecalho = resultado.falhou === resultado.total
    ? `🚨 *${nomeCron}: TODOS os ${resultado.total} clientes falharam*`
    : `⚠️ *${nomeCron}: ${resultado.falhou}/${resultado.total} clientes falharam*`;

  const detalhes = (resultado.erros ?? [])
    .slice(0, 5)
    .map((e) => `• ${e.cliente}: ${e.erro.slice(0, 150)}`)
    .join("\n");

  await enviarWhatsapp(`${cabecalho}\n\n${detalhes || "(sem detalhe por cliente)"}`);
}
