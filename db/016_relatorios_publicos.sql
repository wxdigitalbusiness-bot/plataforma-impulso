-- Migration 016 — Relatórios públicos compartilháveis por link
-- Permite gerar uma URL pública (sem login) com os dados de performance
-- de um cliente em um período específico (semanal / quinzenal / mensal).

CREATE TABLE IF NOT EXISTS relatorios_publicos (
  id          BIGSERIAL    PRIMARY KEY,
  token       TEXT         NOT NULL UNIQUE,
  cliente_id  INT          NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  tipo        TEXT         NOT NULL CHECK (tipo IN ('semanal', 'quinzenal', 'mensal')),
  date_from   DATE         NOT NULL,
  date_to     DATE         NOT NULL,
  criado_em   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  criado_por  TEXT,
  expira_em   TIMESTAMPTZ,
  revogado    BOOLEAN      NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_relatorios_publicos_cliente
  ON relatorios_publicos (cliente_id, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_relatorios_publicos_token
  ON relatorios_publicos (token);
