-- Armazena a URL de webhook anterior (n8n) para encaminhar mensagens
-- durante a migração para a plataforma.
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS n8n_webhook_forward_url TEXT;
