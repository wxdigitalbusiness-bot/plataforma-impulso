-- Migration 028 — Toggle de visibilidade dos Resultados Financeiros no relatório
-- Controla se o total negociado (com/sem tráfego pago) aparece pro cliente
-- no relatório público. A agência sempre vê; o cliente só vê se ligado.

ALTER TABLE relatorios_publicos ADD COLUMN IF NOT EXISTS mostrar_resultados BOOLEAN NOT NULL DEFAULT false;
