"use server";

// Análise por IA do relatório — monta um resumo textual dos números já
// calculados (snapshot Meta salvo + CRM + Google, ao vivo) e manda pra
// Anthropic API gerar uma interpretação em português. Editável depois
// pela agência antes de compartilhar com o cliente.

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCrmFunilDetalhado, getGoogleInsightsRelatorio } from "@/lib/db-insights";
import type { Snapshot } from "@/lib/meta-snapshot";

type ResultadoAcao = { ok: true; texto: string } | { ok: false; erro: string };

async function montarResumo(token: string): Promise<{ resumo: string; clienteNome: string } | { erro: string }> {
  const relatorio = await db.relatorioPublico.findUnique({
    where: { token },
    include: { cliente: true },
  });
  if (!relatorio) return { erro: "Relatório não encontrado." };

  const from = relatorio.dateFrom.toISOString().slice(0, 10);
  const to   = relatorio.dateTo.toISOString().slice(0, 10);
  const clientKey = relatorio.cliente.n8nClientKey;

  const snapshot = relatorio.snapshot as unknown as Snapshot | null;
  const campanhas = (snapshot?.campanhas ?? []).filter((c) => c.spend > 0);
  const totalSpend = campanhas.reduce((s, c) => s + c.spend, 0);
  const totalImpressions = campanhas.reduce((s, c) => s + c.impressions, 0);
  const totalClicks = campanhas.reduce((s, c) => s + c.clicks, 0);
  const totalReach = snapshot?.reachTotal ?? campanhas.reduce((s, c) => s + c.reach, 0);
  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

  const [crmFunil, googleData] = await Promise.all([
    clientKey ? getCrmFunilDetalhado(clientKey, from, to) : Promise.resolve(null),
    clientKey ? getGoogleInsightsRelatorio(clientKey, from, to) : Promise.resolve(null),
  ]);

  const linhas: string[] = [];
  linhas.push(`Cliente: ${relatorio.cliente.nome}`);
  linhas.push(`Período do relatório: ${from} a ${to}`);

  if (campanhas.length > 0) {
    linhas.push("");
    linhas.push("== Meta Ads ==");
    linhas.push(`Investimento total: R$ ${totalSpend.toFixed(2)}`);
    linhas.push(`Alcance: ${totalReach}`);
    linhas.push(`Impressões: ${totalImpressions}`);
    linhas.push(`Cliques no link: ${totalClicks}`);
    linhas.push(`CTR médio: ${ctr.toFixed(2)}%`);
    for (const c of campanhas) {
      const resultado = c.resultado ? `${c.resultado.valor} ${c.resultado.label} (R$ ${c.resultado.custoPorResultado.toFixed(2)}/resultado)` : "sem resultado definido";
      linhas.push(`- Campanha "${c.campaignName}" (${c.objective ?? "objetivo não informado"}): gasto R$ ${c.spend.toFixed(2)}, ${resultado}, CTR ${c.ctr.toFixed(2)}%`);
    }
  }

  if (googleData && googleData.totais.spend > 0) {
    linhas.push("");
    linhas.push("== Google Ads ==");
    linhas.push(`Investimento: R$ ${googleData.totais.spend.toFixed(2)}`);
    linhas.push(`Cliques: ${googleData.totais.cliques}`);
    linhas.push(`Conversões: ${googleData.totais.conversoes}`);
    for (const c of googleData.campanhas) {
      linhas.push(`- Campanha "${c.campaignName}": gasto R$ ${c.spend.toFixed(2)}, ${c.conversoes} conversões`);
    }
  }

  if (crmFunil && crmFunil.totalLeads > 0) {
    linhas.push("");
    linhas.push("== Funil de leads (CRM) ==");
    linhas.push(`Total de leads no período: ${crmFunil.totalLeads}`);
    for (const f of crmFunil.porFase) {
      linhas.push(`- ${f.fase}: ${f.qtd}`);
    }
  }

  return { resumo: linhas.join("\n"), clienteNome: relatorio.cliente.nome };
}

async function chamarClaude(resumo: string, clienteNome: string): Promise<ResultadoAcao> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, erro: "ANTHROPIC_API_KEY não configurada no servidor." };

  const prompt =
    `Você é um analista de marketing digital de uma agência. Com base nos dados abaixo da campanha do cliente "${clienteNome}", ` +
    `escreva uma análise em português do Brasil (3 a 5 parágrafos curtos), tom profissional e direto. ` +
    `Destaque o que funcionou bem, pontos de atenção e uma sugestão prática de próximo passo. ` +
    `Não liste os números de novo — interprete-os. Não use markdown, texto corrido.\n\n${resumo}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const json = await res.json() as {
      content?: Array<{ text?: string }>;
      error?: { message: string };
    };
    if (!res.ok || json.error) {
      return { ok: false, erro: json.error?.message ?? `HTTP ${res.status}` };
    }
    const texto = json.content?.[0]?.text?.trim();
    if (!texto) return { ok: false, erro: "Resposta vazia da IA." };
    return { ok: true, texto };
  } catch (err) {
    return { ok: false, erro: err instanceof Error ? err.message : String(err) };
  }
}

export async function gerarAnaliseIA(token: string): Promise<ResultadoAcao> {
  const session = await auth();
  if (!session?.user) return { ok: false, erro: "Não autenticado." };

  const dados = await montarResumo(token);
  if ("erro" in dados) return { ok: false, erro: dados.erro };

  const resultado = await chamarClaude(dados.resumo, dados.clienteNome);
  if (!resultado.ok) return resultado;

  await db.relatorioPublico.update({
    where: { token },
    data: { analiseIa: resultado.texto, analiseIaGeradoEm: new Date() },
  });

  revalidatePath(`/r/${token}`);
  return resultado;
}

export async function salvarAnaliseIA(
  token: string,
  texto: string,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, erro: "Não autenticado." };

  const limpo = texto.trim();
  if (!limpo) return { ok: false, erro: "Texto não pode ficar vazio." };

  await db.relatorioPublico.update({
    where: { token },
    data: { analiseIa: limpo },
  });

  revalidatePath(`/r/${token}`);
  return { ok: true };
}
