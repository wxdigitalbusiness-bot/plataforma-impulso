-- Migration 013 — Bot Marketing Impulso: A/B tests de prompts
-- 1 registro por experimento. Pode haver no máximo 1 experimento "rodando" por modo_alvo.

CREATE TABLE IF NOT EXISTS bot_experimentos_ab (
  id              SERIAL PRIMARY KEY,
  analise_id      INT REFERENCES bot_analises_semanais(id) ON DELETE SET NULL,

  nome            VARCHAR(200) NOT NULL,
  hipotese        TEXT,

  -- Qual prompt está sendo testado (na v3 só temos modo "unico" porque o AI Agent é único)
  modo_alvo       VARCHAR(20) NOT NULL,    -- unico | atendente | sdr | closer
  variante_a      TEXT NOT NULL,           -- prompt A (controle, atual)
  variante_b      TEXT NOT NULL,           -- prompt B (novo)

  metrica_alvo    VARCHAR(40) NOT NULL,    -- taxa_fechamento | taxa_chegou_preco | taxa_resposta_inicial
  amostra_minima  INT NOT NULL DEFAULT 20, -- mínimo de conversas por variante antes de decidir

  status          VARCHAR(20) NOT NULL DEFAULT 'rodando',  -- rodando | concluido | abortado | promovido

  data_inicio     TIMESTAMPTZ DEFAULT NOW(),
  data_fim        TIMESTAMPTZ,

  resultado_a     JSONB,                   -- { conversas, ganhos, perdidas, taxa, ... }
  resultado_b     JSONB,
  vencedor        CHAR(1),                 -- A | B | NULL (empate / inconclusivo)
  promovido_em    TIMESTAMPTZ,

  criado_em       TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_experimentos_status  ON bot_experimentos_ab(status);
CREATE INDEX IF NOT EXISTS idx_bot_experimentos_analise ON bot_experimentos_ab(analise_id);

-- Só pode haver UM experimento rodando por modo_alvo ao mesmo tempo:
CREATE UNIQUE INDEX IF NOT EXISTS uniq_bot_experimento_rodando_por_modo
  ON bot_experimentos_ab(modo_alvo)
  WHERE status = 'rodando';

-- FK de bot_conversas.experimento_id agora pode ser criada:
ALTER TABLE bot_conversas
  DROP CONSTRAINT IF EXISTS bot_conversas_experimento_fk;
ALTER TABLE bot_conversas
  ADD CONSTRAINT bot_conversas_experimento_fk
    FOREIGN KEY (experimento_id) REFERENCES bot_experimentos_ab(id) ON DELETE SET NULL;
