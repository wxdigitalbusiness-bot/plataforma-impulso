-- Migration 032 — Faturamento (cobranças da agência pro cliente)

CREATE TABLE IF NOT EXISTS cliente_faturas (
  id            BIGSERIAL PRIMARY KEY,
  cliente_id    INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  descricao     TEXT NOT NULL,
  valor         DECIMAL(12,2) NOT NULL,
  vencimento    DATE NOT NULL,
  pago          BOOLEAN NOT NULL DEFAULT false,
  pago_em       TIMESTAMPTZ,
  criado_por    TEXT,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cliente_faturas_cliente
  ON cliente_faturas (cliente_id, vencimento DESC);
