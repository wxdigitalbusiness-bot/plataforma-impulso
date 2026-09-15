-- Migration 036 — Marca leads criados manualmente pela agência (fora de
-- webhook/WhatsApp), pra não sumirem do Kanban quando o cliente usa o filtro
-- "somente tráfego pago" (que hoje só mostra leads com ad_id/ctwa_clid/gclid).

ALTER TABLE fb_leads ADD COLUMN IF NOT EXISTS criado_manual BOOLEAN NOT NULL DEFAULT false;
