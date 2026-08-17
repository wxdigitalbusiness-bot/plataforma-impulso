-- Migration 029 — Filtro de origem dos Resultados Financeiros no relatório
-- Controla se a seção mostra Total geral (pago+orgânico), só pago ou só
-- orgânico. Independente do toggle de visibilidade (mostrar_resultados).

ALTER TABLE relatorios_publicos ADD COLUMN IF NOT EXISTS resultados_origem TEXT NOT NULL DEFAULT 'todos';

ALTER TABLE relatorios_publicos DROP CONSTRAINT IF EXISTS relatorios_publicos_resultados_origem_check;
ALTER TABLE relatorios_publicos ADD CONSTRAINT relatorios_publicos_resultados_origem_check
  CHECK (resultados_origem IN ('todos', 'pago', 'organico'));
