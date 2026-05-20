-- Migração 006: adicionar colunas Google Ads em clientes_ativos
-- Rodar via n8n (Execute Query no Postgres EasyPanel) ou psql

ALTER TABLE clientes_ativos
  ADD COLUMN IF NOT EXISTS google_ad_customer_id      TEXT,
  ADD COLUMN IF NOT EXISTS limite_minimo_google        NUMERIC(12,2) NOT NULL DEFAULT 100.00,
  ADD COLUMN IF NOT EXISTS receber_alerta_google       BOOLEAN       NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ultimo_saldo_google         NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS ultimo_tipo_conta_google    TEXT,
  ADD COLUMN IF NOT EXISTS ultimo_erro_google          TEXT,
  ADD COLUMN IF NOT EXISTS saldo_google_atualizado_em  TIMESTAMPTZ;

-- Índice para facilitar queries no workflow ALERTA-GOOGLE
CREATE INDEX IF NOT EXISTS idx_clientes_google_alerta
  ON clientes_ativos (receber_alerta_google, ativo)
  WHERE receber_alerta_google = true AND ativo = true;
