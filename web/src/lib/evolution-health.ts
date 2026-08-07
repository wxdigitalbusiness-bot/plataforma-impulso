// Detecta instâncias Evolution API "zumbis" — a API reporta status "open"
// (conectado) mas o WebSocket real com o WhatsApp morreu silenciosamente e
// nenhuma mensagem nova chega. Foi o que aconteceu com Sarah Carmo e Fest
// Pizza em 2026-08: ficaram ~14 dias sem gerar lead sem nenhum alerta.
//
// Dois sinais combinados:
//   1. Status da Evolution API != "open" → problema óbvio, sempre alerta.
//   2. Nenhuma mensagem chega no nosso banco há mais de X horas, mesmo tendo
//      histórico anterior → sintoma da conexão zumbi, mesmo com status "open".

import { db } from "@/lib/db";
import { EVOLUTION_API_URL, evoHeaders } from "@/lib/whatsapp-sessions";

const HORAS_SEM_MENSAGEM_LIMITE = Number(process.env.EVOLUTION_HEALTH_HORAS_LIMITE ?? 48);

type InstanceStatus = { name: string; state: string };

async function buscarStatusInstancias(): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  if (!EVOLUTION_API_URL) return mapa;

  try {
    const res = await fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
      headers: evoHeaders(),
      cache: "no-store",
    });
    if (!res.ok) return mapa;
    const json = (await res.json()) as unknown;
    const lista = Array.isArray(json) ? json : [];
    for (const item of lista as Array<Record<string, unknown>>) {
      const inst = item.instance as Record<string, unknown> | undefined;
      const name = (item.name as string) ?? (inst?.instanceName as string) ?? "";
      const state = (item.connectionStatus as string) ?? (inst?.status as string) ?? "desconhecido";
      if (name) mapa.set(name, state);
    }
  } catch (err) {
    console.error("[EVOLUTION-HEALTH] falha ao buscar instâncias:", err);
  }
  return mapa;
}

export type ProblemaConexao = {
  clienteNome: string;
  instancia: string;
  status: string;
  horasSemMensagem: number | null; // null = nunca teve mensagem registrada
};

export async function verificarConexoesEvolution(): Promise<ProblemaConexao[]> {
  const [statusPorInstancia, clientes] = await Promise.all([
    buscarStatusInstancias(),
    db.cliente.findMany({
      where: { ativo: true, evolutionInstance: { not: null } },
      select: { nome: true, n8nClientKey: true, evolutionInstance: true },
    }),
  ]);

  const problemas: ProblemaConexao[] = [];

  for (const c of clientes) {
    const instancia = c.evolutionInstance!;
    const status = statusPorInstancia.get(instancia) ?? "não encontrada na Evolution";

    let horasSemMensagem: number | null = null;
    if (c.n8nClientKey) {
      const rows = await db.$queryRaw<{ ultima: Date | null }[]>`
        SELECT MAX(recebida_em) as ultima FROM crm_mensagens
        WHERE lower(client_key) = lower(${c.n8nClientKey})
      `;
      const ultima = rows[0]?.ultima;
      if (ultima) {
        horasSemMensagem = Math.round((Date.now() - ultima.getTime()) / (1000 * 60 * 60));
      }
    }

    const statusRuim = status !== "open";
    const semMensagemHaMuitoTempo =
      horasSemMensagem !== null && horasSemMensagem > HORAS_SEM_MENSAGEM_LIMITE;

    if (statusRuim || semMensagemHaMuitoTempo) {
      problemas.push({ clienteNome: c.nome, instancia, status, horasSemMensagem });
    }
  }

  return problemas;
}
