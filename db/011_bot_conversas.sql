-- Migration 011 — Bot Marketing Impulso: tabela mestre de conversas
-- Banco: impulso (mesmo Postgres do EasyPanel)
-- Idempotente. Pode rodar várias vezes sem erro.

CREATE TABLE IF NOT EXISTS bot_conversas (
  id              SERIAL PRIMARY KEY,
  phone           VARCHAR(30) UNIQUE NOT NULL,
  push_name       VARCHAR(120),
  origem          VARCHAR(40),              -- anuncio_instagram | direto | indicacao | desconhecido
  ab_variante     CHAR(1),                  -- A | B | NULL (sem A/B test ativo na hora)
  experimento_id  INT,                      -- FK para bot_experimentos_ab (constraint criada em 013)
  primeira_msg_em TIMESTAMPTZ DEFAULT NOW(),
  ultima_msg_em   TIMESTAMPTZ DEFAULT NOW(),
  resultado       VARCHAR(20),              -- ganho | perdido | em_aberto
  motivo_perda    VARCHAR(40),              -- preco | tempo | sumiu | outro
  fechado_em      TIMESTAMPTZ,
  perdido_em      TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}'::jsonb,
  criado_em       TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_conversas_phone        ON bot_conversas(phone);
CREATE INDEX IF NOT EXISTS idx_bot_conversas_resultado    ON bot_conversas(resultado);
CREATE INDEX IF NOT EXISTS idx_bot_conversas_experimento  ON bot_conversas(experimento_id);
CREATE INDEX IF NOT EXISTS idx_bot_conversas_ultima_msg   ON bot_conversas(ultima_msg_em DESC);
