-- Migration 012 — Bot Marketing Impulso: relatórios semanais do analista (Claude)
-- 1 registro por semana, com payload JSON completo do output do Claude

CREATE TABLE IF NOT EXISTS bot_analises_semanais (
  id               SERIAL PRIMARY KEY,
  periodo_inicio   DATE NOT NULL,
  periodo_fim      DATE NOT NULL,

  -- Métricas brutas (extraídas das conversas antes de mandar pro Claude)
  total_conversas  INT NOT NULL DEFAULT 0,
  fechadas         INT NOT NULL DEFAULT 0,
  perdidas         INT NOT NULL DEFAULT 0,
  em_aberto        INT NOT NULL DEFAULT 0,
  taxa_fechamento  NUMERIC(5,4),

  -- Resultado do Claude analista
  resumo_executivo TEXT,
  payload          JSONB NOT NULL,          -- JSON completo: padroes_que_funcionaram, sugestoes_de_mudanca, experimentos_propostos_ab, alertas_de_seguranca

  -- Workflow de aprovação humana via plataforma web
  status           VARCHAR(20) NOT NULL DEFAULT 'pendente',  -- pendente | em_revisao | aprovada | rejeitada | aplicada
  decidido_por     VARCHAR(120),            -- email do usuário (Usuario.email)
  decidido_em      TIMESTAMPTZ,
  decisao_notas    TEXT,

  criado_em        TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em    TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_bot_analises_periodo ON bot_analises_semanais(periodo_inicio, periodo_fim);
CREATE INDEX IF NOT EXISTS idx_bot_analises_status ON bot_analises_semanais(status);
