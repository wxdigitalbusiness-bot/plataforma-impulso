-- Migration 027 — Marcar lead como colaborador
-- Flag reversível pra excluir da visualização de leads (kanban, funil,
-- relatórios, atribuição) sem apagar a conversa. Diferente de "perdido"
-- (que é um resultado de venda) — colaborador nunca foi um lead de verdade.

ALTER TABLE fb_leads ADD COLUMN IF NOT EXISTS eh_colaborador BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_fb_leads_colaborador
  ON fb_leads (client_key, eh_colaborador)
  WHERE eh_colaborador = true;
