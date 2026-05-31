-- Migration 015 — Bot Marketing Impulso: muda default de amostra_minima de 20 para 25
-- Aplica a default para novos experimentos. Linhas existentes (se houver) NÃO são alteradas.

ALTER TABLE bot_experimentos_ab
  ALTER COLUMN amostra_minima SET DEFAULT 25;
