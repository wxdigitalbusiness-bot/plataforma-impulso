-- Migration 014 — Bot Marketing Impulso: triggers de atualizado_em
-- Mantém atualizado_em sempre fresco em UPDATEs

CREATE OR REPLACE FUNCTION touch_bot_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bot_conversas_touch ON bot_conversas;
CREATE TRIGGER bot_conversas_touch
BEFORE UPDATE ON bot_conversas
FOR EACH ROW EXECUTE FUNCTION touch_bot_atualizado_em();

DROP TRIGGER IF EXISTS bot_analises_semanais_touch ON bot_analises_semanais;
CREATE TRIGGER bot_analises_semanais_touch
BEFORE UPDATE ON bot_analises_semanais
FOR EACH ROW EXECUTE FUNCTION touch_bot_atualizado_em();

DROP TRIGGER IF EXISTS bot_experimentos_ab_touch ON bot_experimentos_ab;
CREATE TRIGGER bot_experimentos_ab_touch
BEFORE UPDATE ON bot_experimentos_ab
FOR EACH ROW EXECUTE FUNCTION touch_bot_atualizado_em();

-- View útil pra leitura na plataforma — métricas dos últimos 7 dias:
CREATE OR REPLACE VIEW bot_metricas_7dias AS
SELECT
  COUNT(*) FILTER (WHERE primeira_msg_em >= NOW() - INTERVAL '7 days') AS total_conversas,
  COUNT(*) FILTER (WHERE resultado = 'ganho' AND fechado_em >= NOW() - INTERVAL '7 days') AS fechadas,
  COUNT(*) FILTER (WHERE resultado = 'perdido' AND perdido_em >= NOW() - INTERVAL '7 days') AS perdidas,
  COUNT(*) FILTER (WHERE resultado = 'em_aberto' AND ultima_msg_em >= NOW() - INTERVAL '7 days') AS em_aberto,
  CASE
    WHEN COUNT(*) FILTER (WHERE primeira_msg_em >= NOW() - INTERVAL '7 days') = 0 THEN NULL
    ELSE
      ROUND(
        COUNT(*) FILTER (WHERE resultado = 'ganho' AND fechado_em >= NOW() - INTERVAL '7 days')::numeric
        / NULLIF(COUNT(*) FILTER (WHERE primeira_msg_em >= NOW() - INTERVAL '7 days'), 0),
        4
      )
  END AS taxa_fechamento
FROM bot_conversas;
