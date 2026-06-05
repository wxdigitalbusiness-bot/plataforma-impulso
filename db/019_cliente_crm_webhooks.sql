-- Migration 019 — Webhooks CRM auto-gerados por cliente
-- Cada cliente tem 5 webhooks (um por etapa) que recebem POSTs do CRM externo
-- e fazem UPSERT em fb_leads. A plataforma cria os workflows no n8n via API
-- e armazena aqui o path do webhook + o workflow_id pra poder gerenciar.

CREATE TABLE IF NOT EXISTS cliente_crm_webhooks (
  id                BIGSERIAL    PRIMARY KEY,
  cliente_id        INT          NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  etapa             TEXT         NOT NULL CHECK (etapa IN (
    'novo_lead', 'nao_classificado', 'qualificado', 'perdido', 'concluido'
  )),
  webhook_path      TEXT         NOT NULL,
  webhook_url       TEXT         NOT NULL,
  n8n_workflow_id   TEXT         NOT NULL,
  criado_em         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  atualizado_em     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (cliente_id, etapa)
);

CREATE INDEX IF NOT EXISTS idx_cliente_crm_webhooks_cliente
  ON cliente_crm_webhooks (cliente_id);
