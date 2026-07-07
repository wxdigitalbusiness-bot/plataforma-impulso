ALTER TABLE cliente_crm_webhooks
  ADD COLUMN IF NOT EXISTS tipo_conversao TEXT;
-- values: NULL (nenhum) | 'qualificado' | 'concluido'
