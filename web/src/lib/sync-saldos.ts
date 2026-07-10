// Sincroniza saldos (Meta Ads + Google Ads) de todos os clientes ativos no Postgres.
// Mesma lógica dos workflows n8n [SYNC] e [SYNC-GOOGLE] — duplicada aqui
// para permitir refresh manual do dashboard sem depender do n8n.

import { db } from "@/lib/db";
import { consultarSaldoMeta } from "@/lib/meta-api";
import { consultarSaldoGoogle } from "@/lib/google-ads-api";
import { EVOLUTION_API_URL, evoHeaders } from "@/lib/whatsapp-sessions";

// Instância Evolution usada para enviar alertas de saldo (número da agência)
const ALERT_INSTANCE = process.env.ALERT_EVOLUTION_INSTANCE ?? "IMPULSO";

// ─── Envio de alerta via WhatsApp ────────────────────────────────────────────

async function enviarAlerta(opts: {
  contaId: number;
  saldo: number;
  limite: number;
  whatsapp: string;
  plataforma: "Meta Ads" | "Google Ads";
  nomeConta: string;
}) {
  const { contaId, saldo, limite, whatsapp, plataforma, nomeConta } = opts;

  // Cooldown: não envia mais de 1 alerta por conta por plataforma nas últimas 20h
  const recente = await db.$queryRaw<{ total: bigint }[]>`
    SELECT COUNT(*)::bigint as total FROM alertas_saldo_log
    WHERE cliente_id = ${contaId}
      AND enviado_em > NOW() - INTERVAL '20 hours'
  `;
  if (Number(recente[0]?.total ?? 0) > 0) return;

  const saldoFmt = saldo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const limiteFmt = limite.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const texto =
    `⚠️ *Alerta de saldo baixo*\n\n` +
    `Conta: *${nomeConta}*\n` +
    `Plataforma: ${plataforma}\n` +
    `Saldo atual: *${saldoFmt}*\n` +
    `Limite mínimo: ${limiteFmt}\n\n` +
    `Por favor, recarregue o saldo para evitar interrupção das campanhas.`;

  const jid = whatsapp.includes("@") ? whatsapp : `${whatsapp}@s.whatsapp.net`;
  let status = "enviado";
  let erro: string | null = null;

  try {
    const res = await fetch(
      `${EVOLUTION_API_URL}/message/sendText/${encodeURIComponent(ALERT_INSTANCE)}`,
      {
        method: "POST",
        headers: { ...evoHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ number: jid, text: texto }),
      }
    );
    if (!res.ok) {
      const body = await res.text();
      status = "falhou";
      erro = `HTTP ${res.status}: ${body.slice(0, 200)}`;
    }
  } catch (err) {
    status = "falhou";
    erro = String(err);
  }

  await db.$executeRaw`
    INSERT INTO alertas_saldo_log (cliente_id, saldo_no_momento, limite_no_momento, whatsapp_destino, status, erro)
    VALUES (${contaId}, ${saldo}, ${limite}, ${whatsapp}, ${status}, ${erro})
  `;
}

export type SyncResult = {
  plataforma: "meta" | "google" | "todas";
  total: number;
  sucesso: number;
  falhou: number;
  posPagasAutoDesligadas: number;
  duracaoMs: number;
};

// ─── Meta Ads ────────────────────────────────────────────────────────────────

export async function sincronizarSaldosMeta(): Promise<SyncResult> {
  const inicio = Date.now();
  // Só contas com meta_ad_account_id preenchido — evita consultar Graph API
  // com ID nulo (causa do bug que travou o SYNC Meta no n8n)
  const clientes = await db.clienteAtivo.findMany({
    where: { ativo: true, metaAdAccountId: { not: null } },
    select: {
      id: true,
      nome: true,
      metaAdAccountId: true,
      receberAlertaSaldo: true,
      limiteMinimo: true,
      whatsappAlerta: true,
    },
  });

  let sucesso = 0;
  let falhou = 0;
  let posPagasAutoDesligadas = 0;

  const BATCH_SIZE = 5;
  for (let i = 0; i < clientes.length; i += BATCH_SIZE) {
    const batch = clientes.slice(i, i + BATCH_SIZE);
    const resultados = await Promise.all(
      batch.map(async (c) => ({
        cliente: c,
        saldo: await consultarSaldoMeta(c.metaAdAccountId!),
      }))
    );

    for (const { cliente, saldo } of resultados) {
      const ehPosPaga = saldo.tipoConta === "pos_paga";
      const deveDesligar = ehPosPaga && cliente.receberAlertaSaldo;

      try {
        await db.clienteAtivo.update({
          where: { id: cliente.id },
          data: {
            ultimoSaldo: saldo.saldoRestante,
            ultimoTipoConta: saldo.tipoConta,
            ultimoMetodoPagamento: saldo.metodoPagamentoLabel,
            ultimoErro: saldo.erro,
            saldoAtualizadoEm: new Date(),
            ...(deveDesligar ? { receberAlertaSaldo: false } : {}),
          },
        });
        if (saldo.erro) falhou++;
        else sucesso++;
        if (deveDesligar) posPagasAutoDesligadas++;
      } catch (err) {
        console.error(`[META] Falha ao gravar cliente ${cliente.id}:`, err);
        falhou++;
      }

      // Alerta de saldo baixo (só pré-paga, sem erro, abaixo do limite)
      if (
        !saldo.erro &&
        saldo.tipoConta !== "pos_paga" &&
        saldo.saldoRestante !== null &&
        saldo.saldoRestante < Number(cliente.limiteMinimo) &&
        cliente.whatsappAlerta
      ) {
        enviarAlerta({
          contaId: cliente.id,
          saldo: saldo.saldoRestante,
          limite: Number(cliente.limiteMinimo),
          whatsapp: cliente.whatsappAlerta,
          plataforma: "Meta Ads",
          nomeConta: cliente.nome,
        }).catch((e) => console.error(`[META-ALERTA] ${cliente.id}:`, e));
      }
    }
  }

  return {
    plataforma: "meta",
    total: clientes.length,
    sucesso,
    falhou,
    posPagasAutoDesligadas,
    duracaoMs: Date.now() - inicio,
  };
}

// ─── Google Ads ──────────────────────────────────────────────────────────────

export async function sincronizarSaldosGoogle(): Promise<SyncResult> {
  const inicio = Date.now();

  // Só clientes com Customer ID preenchido
  const clientes = await db.clienteAtivo.findMany({
    where: { ativo: true, googleAdCustomerId: { not: null } },
    select: {
      id: true,
      nome: true,
      googleAdCustomerId: true,
      googleAdsMccId: true,
      receberAlertaGoogle: true,
      limiteMinimoGoogle: true,
      whatsappAlerta: true,
    },
  });

  let sucesso = 0;
  let falhou = 0;
  let posPagasAutoDesligadas = 0;

  const BATCH_SIZE = 5;
  for (let i = 0; i < clientes.length; i += BATCH_SIZE) {
    const batch = clientes.slice(i, i + BATCH_SIZE);
    const resultados = await Promise.all(
      batch.map(async (c) => ({
        cliente: c,
        saldo: await consultarSaldoGoogle(c.googleAdCustomerId!, c.googleAdsMccId),
      }))
    );

    for (const { cliente, saldo } of resultados) {
      const ehPosPaga = saldo.tipoConta === "pos_paga";
      const deveDesligar = ehPosPaga && cliente.receberAlertaGoogle;

      try {
        await db.clienteAtivo.update({
          where: { id: cliente.id },
          data: {
            ultimoSaldoGoogle: saldo.saldoRestante,
            ultimoTipoContaGoogle: saldo.tipoConta,
            ultimoErroGoogle: saldo.erro,
            saldoGoogleAtualizadoEm: new Date(),
            ...(deveDesligar ? { receberAlertaGoogle: false } : {}),
          },
        });
        if (saldo.erro) falhou++;
        else sucesso++;
        if (deveDesligar) posPagasAutoDesligadas++;
      } catch (err) {
        console.error(`[GOOGLE] Falha ao gravar cliente ${cliente.id}:`, err);
        falhou++;
      }

      // Alerta de saldo baixo Google
      if (
        !saldo.erro &&
        saldo.tipoConta !== "pos_paga" &&
        saldo.saldoRestante !== null &&
        saldo.saldoRestante < Number(cliente.limiteMinimoGoogle) &&
        cliente.whatsappAlerta
      ) {
        enviarAlerta({
          contaId: cliente.id,
          saldo: saldo.saldoRestante,
          limite: Number(cliente.limiteMinimoGoogle),
          whatsapp: cliente.whatsappAlerta,
          plataforma: "Google Ads",
          nomeConta: cliente.nome,
        }).catch((e) => console.error(`[GOOGLE-ALERTA] ${cliente.id}:`, e));
      }
    }
  }

  return {
    plataforma: "google",
    total: clientes.length,
    sucesso,
    falhou,
    posPagasAutoDesligadas,
    duracaoMs: Date.now() - inicio,
  };
}

// ─── Ambas as plataformas (botão "Atualizar agora" do dashboard) ─────────────

export async function sincronizarSaldosTodos(): Promise<SyncResult> {
  const inicio = Date.now();
  const [meta, google] = await Promise.all([
    sincronizarSaldosMeta(),
    sincronizarSaldosGoogle(),
  ]);

  return {
    plataforma: "todas",
    total: meta.total + google.total,
    sucesso: meta.sucesso + google.sucesso,
    falhou: meta.falhou + google.falhou,
    posPagasAutoDesligadas:
      meta.posPagasAutoDesligadas + google.posPagasAutoDesligadas,
    duracaoMs: Date.now() - inicio,
  };
}
