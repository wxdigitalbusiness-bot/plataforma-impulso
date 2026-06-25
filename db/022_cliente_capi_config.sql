-- Migration 022 — Configuração CAPI e Evolution por cliente
-- Cada cliente pode ter seu próprio Pixel Meta e instância do WhatsApp.
-- evolution_instance: nome exato da instância na Evolution API
--   (ex: "Sarah Carmo - Multimarcas") — usado para mapear webhooks ao cliente.
-- pixel_id + capi_token: credenciais para disparar eventos via Facebook CAPI
--   quando um lead chega à etapa "concluido".

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS evolution_instance  TEXT,
  ADD COLUMN IF NOT EXISTS pixel_id            TEXT,
  ADD COLUMN IF NOT EXISTS capi_token          TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_evolution_instance
  ON clientes (evolution_instance)
  WHERE evolution_instance IS NOT NULL;
