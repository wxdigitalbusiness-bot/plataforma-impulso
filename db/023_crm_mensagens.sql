-- Migration 023 — Histórico de mensagens do CRM
-- Armazena todas as mensagens trocadas entre leads e atendentes,
-- capturadas via webhook da Evolution API ou enviadas pelo painel.

CREATE TABLE IF NOT EXISTS crm_mensagens (
  id               BIGSERIAL     PRIMARY KEY,
  lead_id          TEXT          NOT NULL,
  client_key       TEXT          NOT NULL,
  -- "lead" = mensagem recebida do WhatsApp | "atendente" = enviada pelo painel
  de               TEXT          NOT NULL CHECK (de IN ('lead', 'atendente')),
  -- text | image | audio | video | document | sticker
  tipo             TEXT          NOT NULL DEFAULT 'text',
  -- texto da mensagem ou legenda da mídia
  conteudo         TEXT,
  -- URL da mídia (null para mensagens de texto)
  media_url        TEXT,
  -- ID único da mensagem na Evolution API — evita duplicatas no webhook
  evolution_msg_id TEXT          UNIQUE,
  recebida_em      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  criado_em        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_mensagens_lead
  ON crm_mensagens (lead_id, recebida_em DESC);

CREATE INDEX IF NOT EXISTS idx_crm_mensagens_client
  ON crm_mensagens (client_key, recebida_em DESC);
