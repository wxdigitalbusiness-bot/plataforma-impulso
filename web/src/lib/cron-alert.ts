// Alerta via WhatsApp quando um cron interno quebra ou falha parcialmente.
// Mesmo padrão de envio usado em sync-saldos.ts (Evolution API).

import { EVOLUTION_API_URL, evoHeaders } from "@/lib/whatsapp-sessions";

const ALERT_INSTANCE  = process.env.ALERT_EVOLUTION_INSTANCE ?? "IMPULSO";
// ponytail: número fixo em vez de config por usuário — só uma agência usa essa plataforma
const ALERT_WHATSAPP  = process.env.CRON_ALERT_WHATSAPP ?? "5563984386017";

export async function enviarWhatsapp(texto: string) {
  if (!EVOLUTION_API_URL) return;
  try {
    const jid = `${ALERT_WHATSAPP}@s.whatsapp.net`;
    const res = await fetch(
      `${EVOLUTION_API_URL}/message/sendText/${encodeURIComponent(ALERT_INSTANCE)}`,
      {
        method: "POST",
        headers: { ...evoHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ number: jid, text: texto }),
      },
    );
    if (!res.ok) console.error("[CRON-ALERTA] Evolution respondeu", res.status, await res.text());
  } catch (err) {
    console.error("[CRON-ALERTA] falha ao enviar WhatsApp:", err);
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
