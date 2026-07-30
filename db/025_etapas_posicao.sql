-- Migration 025 — Ordem customizável das etapas do funil
-- Adiciona posicao em cliente_crm_webhooks e faz backfill preservando a
-- ordem atual (base antes de extras, por data de criação).

ALTER TABLE cliente_crm_webhooks ADD COLUMN IF NOT EXISTS posicao INTEGER;

WITH ordenado AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY cliente_id
    ORDER BY eh_extra ASC, criado_em ASC
  ) AS rn
  FROM cliente_crm_webhooks
)
UPDATE cliente_crm_webhooks w
SET posicao = ordenado.rn
FROM ordenado
WHERE w.id = ordenado.id AND w.posicao IS NULL;

ALTER TABLE cliente_crm_webhooks ALTER COLUMN posicao SET NOT NULL;
ALTER TABLE cliente_crm_webhooks ALTER COLUMN posicao SET DEFAULT 0;
