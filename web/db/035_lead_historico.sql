-- Migration 035 — Histórico de etapas do lead
-- Registra cada transição de fase (entrada inicial, mudanças manuais e re-entradas)
-- para montar uma linha do tempo completa no painel do lead.

CREATE TABLE IF NOT EXISTS crm_historico_etapas (
  id         BIGSERIAL    PRIMARY KEY,
  lead_id    TEXT         NOT NULL,
  client_key TEXT         NOT NULL,
  etapa      TEXT         NOT NULL,
  tipo       TEXT         NOT NULL DEFAULT 'transicao',
  -- 'entrada'   = criação inicial do lead
  -- 'transicao' = mudança manual de fase pela equipe
  -- 'reentrada' = lead voltou após inatividade ou retorno de fase avançada
  origem     TEXT,        -- 'Meta Ads' | 'Google Ads' | 'Site' | 'Orgânico'
  ad_id      TEXT,
  ctwa_clid  TEXT,
  fase_anterior TEXT,     -- preenchido apenas em tipo='reentrada'
  entrou_em  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  saiu_em    TIMESTAMPTZ            -- NULL = etapa atual
);

CREATE INDEX IF NOT EXISTS idx_crm_historico_lead
  ON crm_historico_etapas (lead_id, client_key, entrou_em DESC);
