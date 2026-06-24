-- Migration 028 — Detalhes do lead: observações, valor de negociação, tags

-- Campos extras em fb_leads
ALTER TABLE fb_leads
  ADD COLUMN IF NOT EXISTS observacoes       TEXT,
  ADD COLUMN IF NOT EXISTS valor_negociacao  NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS utm_campaign      TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium        TEXT,
  ADD COLUMN IF NOT EXISTS utm_term          TEXT,
  ADD COLUMN IF NOT EXISTS utm_content       TEXT;

-- Tags criadas por cliente (nome + cor hex)
CREATE TABLE IF NOT EXISTS crm_tags (
  id          BIGSERIAL    PRIMARY KEY,
  client_key  TEXT         NOT NULL,
  nome        TEXT         NOT NULL,
  cor         TEXT         NOT NULL DEFAULT '#6366f1',
  criado_em   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (client_key, nome)
);

CREATE INDEX IF NOT EXISTS idx_crm_tags_client ON crm_tags (client_key);

-- Relação lead ↔ tags
CREATE TABLE IF NOT EXISTS crm_lead_tags (
  lead_id     TEXT         NOT NULL,
  client_key  TEXT         NOT NULL,
  tag_id      BIGINT       NOT NULL REFERENCES crm_tags(id) ON DELETE CASCADE,
  criado_em   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (lead_id, client_key, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_lead_tags_lead ON crm_lead_tags (lead_id, client_key);
