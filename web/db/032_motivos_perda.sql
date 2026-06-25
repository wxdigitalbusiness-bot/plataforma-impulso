-- Migration 032 — Motivos de perda por cliente CRM
CREATE TABLE IF NOT EXISTS crm_motivos_perda (
  id          BIGSERIAL    PRIMARY KEY,
  client_key  TEXT         NOT NULL,
  motivo      TEXT         NOT NULL,
  criado_em   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (client_key, motivo)
);

CREATE INDEX IF NOT EXISTS idx_crm_motivos_perda_client
  ON crm_motivos_perda (client_key);
