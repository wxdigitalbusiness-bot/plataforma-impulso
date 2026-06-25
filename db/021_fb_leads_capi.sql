-- Migration 021 — Campos CTWA/CAPI em fb_leads
-- Armazena o Click-to-WhatsApp Click ID e a plataforma de origem
-- capturados diretamente do webhook da Evolution API.
-- ctwa_clid é usado para reportar conversões via Facebook CAPI.

ALTER TABLE fb_leads
  ADD COLUMN IF NOT EXISTS ctwa_clid   TEXT,
  ADD COLUMN IF NOT EXISTS source_app  TEXT;

-- Índice para consultas de leads com atribuição CAPI pendente
CREATE INDEX IF NOT EXISTS idx_fb_leads_ctwa_clid
  ON fb_leads (ctwa_clid)
  WHERE ctwa_clid IS NOT NULL;
