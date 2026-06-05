-- Migration 020 — Etapas CRM customizáveis por cliente
-- Antes: 5 etapas fixas (novo_lead, nao_classificado, qualificado, perdido, concluido).
-- Agora: cliente pode ter etapas extras com nomes próprios (ex: "Em negociação").

ALTER TABLE cliente_crm_webhooks
  DROP CONSTRAINT IF EXISTS cliente_crm_webhooks_etapa_check;

ALTER TABLE cliente_crm_webhooks
  ADD COLUMN IF NOT EXISTS etapa_label TEXT;

ALTER TABLE cliente_crm_webhooks
  ADD COLUMN IF NOT EXISTS eh_extra BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill: as 5 etapas-base ganham label fixo (e ficam com eh_extra=false)
UPDATE cliente_crm_webhooks SET etapa_label = CASE etapa
  WHEN 'novo_lead'        THEN 'Novo Lead'
  WHEN 'nao_classificado' THEN 'Não classificado'
  WHEN 'qualificado'      THEN 'Qualificado'
  WHEN 'perdido'          THEN 'Perdido'
  WHEN 'concluido'        THEN 'Negócio concluído'
  ELSE etapa
END WHERE etapa_label IS NULL;

ALTER TABLE cliente_crm_webhooks
  ALTER COLUMN etapa_label SET NOT NULL;
