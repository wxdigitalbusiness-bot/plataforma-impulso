-- Migration 026 — Análise por IA no relatório público
-- Texto gerado pela Anthropic API a partir dos números do relatório,
-- editável manualmente pela agência antes de compartilhar com o cliente.

ALTER TABLE relatorios_publicos ADD COLUMN IF NOT EXISTS analise_ia TEXT;
ALTER TABLE relatorios_publicos ADD COLUMN IF NOT EXISTS analise_ia_gerado_em TIMESTAMPTZ;
