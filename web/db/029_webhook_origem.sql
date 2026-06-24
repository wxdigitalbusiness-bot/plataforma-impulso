-- Migration 029 — Identifica a origem do lead: plataforma própria vs n8n/legado

ALTER TABLE fb_leads
  ADD COLUMN IF NOT EXISTS webhook_origem TEXT;

-- Backfill: leads que já têm mensagens em crm_mensagens vieram pela plataforma
UPDATE fb_leads fl
SET webhook_origem = 'plataforma'
WHERE webhook_origem IS NULL
  AND EXISTS (
    SELECT 1 FROM crm_mensagens cm
    WHERE cm.lead_id = fl.lead_id
      AND lower(cm.client_key) = lower(fl.client_key)
  );

CREATE INDEX IF NOT EXISTS idx_fb_leads_webhook_origem ON fb_leads (client_key, webhook_origem);
