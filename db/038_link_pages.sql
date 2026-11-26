-- Migration 038 — Páginas estilo Linktree por trás de QR Code / NFC
-- (serviço novo de plaquinhas físicas). slug é fixo (vai impresso na
-- plaquinha); nome/titulo/bio/links são editáveis livremente depois.

CREATE TABLE IF NOT EXISTS link_pages (
  id            SERIAL PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,
  nome          TEXT NOT NULL,
  cliente_id    INT REFERENCES clientes(id) ON DELETE SET NULL,
  titulo        TEXT,
  bio           TEXT,
  foto_url      TEXT,
  links         JSONB NOT NULL DEFAULT '[]'::jsonb,
  ativo         BOOLEAN NOT NULL DEFAULT true,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_link_pages_cliente ON link_pages (cliente_id);
