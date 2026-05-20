// Sincroniza saldos Meta Ads de todos os clientes ativos no Postgres.
// Mesma logica do workflow n8n [SYNC] Atualizar Saldos Meta Ads — duplicada aqui
// pra permitir refresh manual do dashboard sem depender do n8n.

import { db } from "@/lib/db";
import { consultarSaldoMeta } from "@/lib/meta-api";

export type SyncResult = {
  total: number;
  sucesso: number;
  falhou: number;
  posPagasAutoDesligadas: number;
  duracaoMs: number;
};

export async function sincronizarSaldosTodos(): Promise<SyncResult> {
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

  // Roda em batches paralelos pra acelerar (Meta tolera bem)
  const BATCH_SIZE = 5;
  for (let i = 0; i < clientes.length; i += BATCH_SIZE) {
    const batch = clientes.slice(i, i + BATCH_SIZE);
    const resultados = await Promise.all(
      batch.map(async (c) => {
        const saldo = await consultarSaldoMeta(c.metaAdAccountId);
        return { cliente: c, saldo };
      }),
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
        console.error(`Falha ao gravar saldo do cliente ${cliente.id}:`, err);
        falhou++;
      }
    }
  }

  return {
    total: clientes.length,
    sucesso,
    falhou,
    posPagasAutoDesligadas,
    duracaoMs: Date.now() - inicio,
  };
}
