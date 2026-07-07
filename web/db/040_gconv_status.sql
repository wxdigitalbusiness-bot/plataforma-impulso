-- Migration 040 — Status do envio de conversão ao Google Ads Offline Conversions API
ALTER TABLE fb_leads
  ADD COLUMN IF NOT EXISTS gconv_status     TEXT,         -- 'ok' | 'erro' | null
  ADD COLUMN IF NOT EXISTS gconv_enviado_em TIMESTAMPTZ;  -- quando foi enviado
