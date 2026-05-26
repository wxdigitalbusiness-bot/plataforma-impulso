-- Migração 008: introduzir entidade Cliente (parent) agrupando contas de anúncio
--
-- Modelo anterior: cada linha em `clientes_ativos` = 1 conta de anúncio.
-- Modelo novo:     `clientes` (entidade real) 1:N `clientes_ativos` (contas).
--
-- Auto-popula: 1 Cliente por valor distinto da coluna `empresa`, depois faz o link.
-- Após a migration, o admin pode renomear/unificar Clientes manualmente pela UI.

BEGIN;

-- 1. Nova tabela `clientes` (entidade parent)
CREATE TABLE IF NOT EXISTS clientes (
  id            SERIAL PRIMARY KEY,
  nome          TEXT        NOT NULL,
  ativo         BOOLEAN     NOT NULL DEFAULT TRUE,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Trigger pra atualizar atualizado_em automaticamente
DROP TRIGGER IF EXISTS trg_clientes_atualizado_em ON clientes;
CREATE TRIGGER trg_clientes_atualizado_em
  BEFORE UPDATE ON clientes
  FOR EACH ROW
  EXECUTE FUNCTION set_atualizado_em();

-- 3. Adicionar foreign key em clientes_ativos (nullable durante a transição)
ALTER TABLE clientes_ativos
  ADD COLUMN IF NOT EXISTS cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL;

-- 4. Popular `clientes` com 1 registro por `empresa` distinta
INSERT INTO clientes (nome, ativo, criado_em, atualizado_em)
SELECT
  empresa AS nome,
  bool_or(ativo) AS ativo,          -- ativo se ao menos 1 conta da empresa estiver ativa
  MIN(criado_em) AS criado_em,
  NOW()          AS atualizado_em
FROM clientes_ativos
WHERE empresa IS NOT NULL AND TRIM(empresa) != ''
GROUP BY empresa
ON CONFLICT DO NOTHING;

-- 5. Linkar cada conta ao Cliente correspondente (match por empresa = nome)
UPDATE clientes_ativos ca
SET cliente_id = c.id
FROM clientes c
WHERE ca.cliente_id IS NULL
  AND c.nome = ca.empresa;

-- 6. Índice para queries do tipo "todas as contas de um cliente"
CREATE INDEX IF NOT EXISTS idx_clientes_ativos_cliente_id
  ON clientes_ativos (cliente_id);

COMMIT;
