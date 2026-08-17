-- Migration 030 — Perfil do cliente (foto + bio) e visibilidade por aba no portal
-- Base pra página de perfil estilo Instagram (foto+nome+bio, abas abaixo).

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS foto_url TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS bio TEXT;

-- Visibilidade por aba no portal do cliente. Backfill preserva o que a lógica
-- atual do portal já mostra hoje (baseada em presença de dados) — ninguém
-- perde acesso a nada no dia do deploy, os toggles só valem daqui pra frente.
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS portal_mostrar_dashboard   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS portal_mostrar_crm         BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS portal_mostrar_relatorios  BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS portal_mostrar_resultados  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS portal_mostrar_historico   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS portal_mostrar_documentos  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS portal_mostrar_faturamento BOOLEAN NOT NULL DEFAULT false;

-- Backfill: liga dashboard/crm/histórico pra quem já tem a conta/dado
-- correspondente configurado (mesma condição que o portal usa hoje).
UPDATE clientes c SET portal_mostrar_dashboard = true
WHERE EXISTS (
  SELECT 1 FROM clientes_ativos ca
  WHERE ca.cliente_id = c.id AND ca.ativo = true
    AND (ca.meta_ad_account_id IS NOT NULL OR ca.google_ad_customer_id IS NOT NULL)
);

UPDATE clientes c SET portal_mostrar_crm = true
WHERE EXISTS (SELECT 1 FROM cliente_crm_webhooks w WHERE w.cliente_id = c.id);

UPDATE clientes c SET portal_mostrar_historico = true
WHERE EXISTS (
  SELECT 1 FROM cliente_historico h
  WHERE h.cliente_id = c.id AND h.visivel_portal = true
);
