-- Migration 018 — Snapshot do relatório público
-- Quando o relatório é gerado, fazemos uma chamada Meta API ao vivo pra
-- capturar valores que batem 100% com o gerenciador (reach deduplicado,
-- results = profile_visit_view, cost_per_result, etc).
-- Esse snapshot fica congelado pro link público — render é rápido depois.

ALTER TABLE relatorios_publicos
  ADD COLUMN IF NOT EXISTS snapshot JSONB;
