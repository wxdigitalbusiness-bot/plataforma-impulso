-- Migration 036 — Status do envio de conversão ao Meta CAPI
ALTER TABLE fb_leads
  ADD COLUMN IF NOT EXISTS capi_status     TEXT,         -- 'ok' | 'erro' | null
  ADD COLUMN IF NOT EXISTS capi_enviado_em TIMESTAMPTZ;  -- quando foi enviado
