-- Migração 007: Meta Ad Account ID vira opcional + campo MCC por cliente
-- Rodar via n8n (Execute Query no Postgres EasyPanel) ou psql

-- Meta passa a ser nullable (clientes só-Google não precisam de conta Meta)
ALTER TABLE clientes_ativos
  ALTER COLUMN meta_ad_account_id DROP NOT NULL;

-- MCC específico por cliente (null = usar MCC padrão da agência)
ALTER TABLE clientes_ativos
  ADD COLUMN IF NOT EXISTS google_ads_mcc_id TEXT;

COMMENT ON COLUMN clientes_ativos.google_ads_mcc_id IS
  'MCC ID do Google Ads deste cliente. NULL = usar MCC padrão da agência (env GOOGLE_ADS_MCC_ID).';
