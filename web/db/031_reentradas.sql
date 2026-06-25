-- Migration 031 — Rastreamento de reentradas de leads
-- Quando um lead já classificado retorna, preservamos a fase anterior
-- e movemos o lead de volta para "Não classificado" automaticamente.

ALTER TABLE fb_leads
  ADD COLUMN IF NOT EXISTS reentradas INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS crm_reentradas (
  id            BIGSERIAL    PRIMARY KEY,
  lead_id       TEXT         NOT NULL,
  client_key    TEXT         NOT NULL,
  fase_anterior TEXT         NOT NULL,
  reentrada_em  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  ad_id         TEXT,
  ctwa_clid     TEXT,
  source_app    TEXT
);

CREATE INDEX IF NOT EXISTS idx_crm_reentradas_lead
  ON crm_reentradas (lead_id, client_key, reentrada_em DESC);
