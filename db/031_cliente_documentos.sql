-- Migration 031 — Documentos do cliente (upload de arquivo real, MinIO)

CREATE TABLE IF NOT EXISTS cliente_documentos (
  id            BIGSERIAL PRIMARY KEY,
  cliente_id    INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  nome          TEXT NOT NULL,
  url           TEXT NOT NULL,
  tamanho       INTEGER NOT NULL,
  tipo          TEXT NOT NULL,
  enviado_por   TEXT,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cliente_documentos_cliente
  ON cliente_documentos (cliente_id, criado_em DESC);
