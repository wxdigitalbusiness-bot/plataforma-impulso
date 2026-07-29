-- Migration 024 — Histórico de ações por cliente ("prontuário")
-- Registro cronológico e manual do que a agência fez para cada cliente.
-- Entradas marcadas como visíveis aparecem no portal do cliente.

CREATE TABLE IF NOT EXISTS cliente_historico (
  id             SERIAL       PRIMARY KEY,
  cliente_id     INTEGER      NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  -- criativo | campanha | segmentacao | site | reuniao | atendimento | problema | interno
  tipo           TEXT         NOT NULL DEFAULT 'interno',
  titulo         TEXT         NOT NULL,
  descricao      TEXT,
  -- Data em que a ação aconteceu (pode ser retroativa; criado_em guarda quando foi registrado)
  data_acao      DATE         NOT NULL DEFAULT CURRENT_DATE,
  autor          TEXT,
  -- Tipos "problema" e "interno" nunca podem ser true (validado na API)
  visivel_portal BOOLEAN      NOT NULL DEFAULT false,
  criado_em      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  atualizado_em  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cliente_historico_cliente
  ON cliente_historico (cliente_id, data_acao DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_cliente_historico_portal
  ON cliente_historico (cliente_id, visivel_portal, data_acao DESC);
