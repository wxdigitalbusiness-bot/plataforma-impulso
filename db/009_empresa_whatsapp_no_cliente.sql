-- Migração 009: mover empresa e whatsapp_alerta para a entidade Cliente (parent)
--
-- Antes: cada conta (clientes_ativos) tinha empresa+whatsapp_alerta próprios.
-- Depois: pertencem ao Cliente (parent). Todas as contas do mesmo cliente compartilham.
--
-- As colunas em clientes_ativos ficam preservadas (sem DROP) por compatibilidade
-- com workflows e código legado. Stop usando elas como source-of-truth.

BEGIN;

-- 1. Adicionar colunas em clientes
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS empresa         TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_alerta TEXT;

-- 2. Backfill empresa: usar o valor de qualquer conta vinculada (primeiro não-nulo, ordem alfabética)
UPDATE clientes c
SET empresa = sub.empresa
FROM (
  SELECT DISTINCT ON (cliente_id) cliente_id, empresa
  FROM clientes_ativos
  WHERE cliente_id IS NOT NULL
    AND empresa IS NOT NULL
    AND TRIM(empresa) != ''
  ORDER BY cliente_id, empresa
) sub
WHERE c.id = sub.cliente_id
  AND c.empresa IS NULL;

-- 3. Backfill whatsapp_alerta: pegar de qualquer conta vinculada (primeiro não-nulo)
UPDATE clientes c
SET whatsapp_alerta = sub.whatsapp_alerta
FROM (
  SELECT DISTINCT ON (cliente_id) cliente_id, whatsapp_alerta
  FROM clientes_ativos
  WHERE cliente_id IS NOT NULL
    AND whatsapp_alerta IS NOT NULL
    AND TRIM(whatsapp_alerta) != ''
  ORDER BY cliente_id, whatsapp_alerta
) sub
WHERE c.id = sub.cliente_id
  AND c.whatsapp_alerta IS NULL;

COMMIT;
