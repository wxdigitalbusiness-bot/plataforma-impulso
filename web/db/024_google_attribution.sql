-- Migration 024: Atribuição Google Ads
-- Adiciona suporte a gclid/UTMs capturados via página de redirecionamento /r/wa/[slug]

-- Colunas de atribuição Google em fb_leads
ALTER TABLE fb_leads ADD COLUMN IF NOT EXISTS gclid       TEXT;
ALTER TABLE fb_leads ADD COLUMN IF NOT EXISTS wbraid      TEXT;
ALTER TABLE fb_leads ADD COLUMN IF NOT EXISTS gbraid      TEXT;
ALTER TABLE fb_leads ADD COLUMN IF NOT EXISTS google_code TEXT; -- código GG-xxxxxx

-- Configuração Google Ads por cliente
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS wa_numero                  TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS google_ads_customer_id     TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS google_conversion_action_id TEXT;

-- Tabela temporária de atribuição Google (code → gclid, vinculado ao lead quando mensagem chegar)
CREATE TABLE IF NOT EXISTS google_attribution (
  id                BIGSERIAL PRIMARY KEY,
  code              TEXT        UNIQUE NOT NULL,
  client_key        TEXT        NOT NULL,
  gclid             TEXT,
  wbraid            TEXT,
  gbraid            TEXT,
  utm_source        TEXT,
  utm_medium        TEXT,
  utm_campaign      TEXT,
  utm_content       TEXT,
  utm_term          TEXT,
  lead_id           TEXT,
  ip                TEXT,
  user_agent        TEXT,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  vinculado_em      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_gattr_code      ON google_attribution(code);
CREATE INDEX IF NOT EXISTS idx_gattr_client_em ON google_attribution(client_key, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_gattr_lead      ON google_attribution(lead_id) WHERE lead_id IS NOT NULL;
