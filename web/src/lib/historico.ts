import { db } from "@/lib/db";

export type EntradaHistorico = {
  id: number;
  cliente_id: number;
  cliente_nome: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  data_acao: string;
  autor: string | null;
  visivel_portal: boolean;
};

/** Histórico interno — tudo, inclusive entradas que não vão pro portal. */
export async function listarHistorico(clienteId?: number): Promise<EntradaHistorico[]> {
  if (clienteId) {
    return db.$queryRaw<EntradaHistorico[]>`
      SELECT ch.id, ch.cliente_id, c.nome AS cliente_nome, ch.tipo, ch.titulo,
             ch.descricao, ch.data_acao::text, ch.autor, ch.visivel_portal
      FROM cliente_historico ch
      JOIN clientes c ON c.id = ch.cliente_id
      WHERE ch.cliente_id = ${clienteId}
      ORDER BY ch.data_acao DESC, ch.id DESC`;
  }
  return db.$queryRaw<EntradaHistorico[]>`
    SELECT ch.id, ch.cliente_id, c.nome AS cliente_nome, ch.tipo, ch.titulo,
           ch.descricao, ch.data_acao::text, ch.autor, ch.visivel_portal
    FROM cliente_historico ch
    JOIN clientes c ON c.id = ch.cliente_id
    ORDER BY ch.data_acao DESC, ch.id DESC
    LIMIT 300`;
}

/** Versão do portal — só o que foi marcado como visível, sem expor o autor. */
export async function listarHistoricoPortal(clienteId: number) {
  return db.$queryRaw<{
    id: number; tipo: string; titulo: string;
    descricao: string | null; data_acao: string;
  }[]>`
    SELECT id, tipo, titulo, descricao, data_acao::text
    FROM cliente_historico
    WHERE cliente_id = ${clienteId} AND visivel_portal = true
    ORDER BY data_acao DESC, id DESC`;
}
