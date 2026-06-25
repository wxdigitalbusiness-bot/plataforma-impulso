-- Migration 033 — Log de eventos do webhook Evolution API
CREATE TABLE IF NOT EXISTS webhook_events (
  id          BIGSERIAL    PRIMARY KEY,
  recebido_em TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  instance    TEXT,
  event_type  TEXT,
  -- 'processado' | 'fromMe' | 'ignorado' | 'erro'
  status      TEXT         NOT NULL DEFAULT 'processado',
  motivo_skip TEXT,
  raw_body    JSONB        NOT NULL,
  phone       TEXT,
  push_name   TEXT,
  from_me     BOOLEAN,
  ad_id       TEXT,
  ctwa_clid   TEXT,
  source_app  TEXT,
  tipo_msg    TEXT,
  conteudo    TEXT,
  client_key  TEXT,
  lead_id     TEXT,
  erro_msg    TEXT
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_recebido
  ON webhook_events (recebido_em DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_instance
  ON webhook_events (instance, recebido_em DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status
  ON webhook_events (status, recebido_em DESC);
