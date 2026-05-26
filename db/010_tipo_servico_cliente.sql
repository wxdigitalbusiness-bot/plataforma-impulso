-- Migração 010: adicionar coluna tipo_servico em clientes
--
-- Tipos suportados (3): panfletagem_digital, gestao_trafego, impulso_360
-- Coluna nullable — clientes legados ficam NULL até serem editados manualmente.

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS tipo_servico TEXT;

-- CHECK constraint para garantir só valores válidos (NULL permitido)
ALTER TABLE clientes
  DROP CONSTRAINT IF EXISTS clientes_tipo_servico_check;

ALTER TABLE clientes
  ADD CONSTRAINT clientes_tipo_servico_check
  CHECK (tipo_servico IS NULL OR tipo_servico IN (
    'panfletagem_digital',
    'gestao_trafego',
    'impulso_360'
  ));
