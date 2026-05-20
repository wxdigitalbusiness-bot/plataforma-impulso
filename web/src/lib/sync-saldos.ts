// Sincroniza saldos (Meta Ads + Google Ads) de todos os clientes ativos no Postgres.
// Mesma lógica dos workflows n8n [SYNC] e [SYNC-GOOGLE] — duplicada aqui
// para permitir refresh manual do dashboard sem depender do n8n.

import { db } from "@/lib/db";
import { consultarSaldoMeta } from "@/lib/meta-api";
import { consultarSaldoGoogle } from "@/lib/google-ads-api";

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
  const clientes = await db.clienteAtivo.findMany({
    where: { ativo: true },
    select: {
      id: true,
      metaAdAccountId: true,
      receberAlertaSaldo: true,
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
        saldo: await consultarSaldoMeta(c.metaAdAccountId),
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
      googleAdCustomerId: true,
      googleAdsMccId: true,
      receberAlertaGoogle: true,
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
