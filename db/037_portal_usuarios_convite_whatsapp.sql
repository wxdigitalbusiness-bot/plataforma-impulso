-- Migration 037 — Acesso ao portal do cliente por convite via WhatsApp.
-- A agência só informa o telefone; o próprio cliente define nome, email e
-- senha ao abrir o link. nome/email/senha_hash passam a ser preenchidos
-- depois (nulos até o convite ser concluído). token + token_expira_em
-- servem tanto para o convite inicial quanto pra "redefinir senha".

ALTER TABLE portal_usuarios ALTER COLUMN nome DROP NOT NULL;
ALTER TABLE portal_usuarios ALTER COLUMN email DROP NOT NULL;
ALTER TABLE portal_usuarios ALTER COLUMN senha_hash DROP NOT NULL;
ALTER TABLE portal_usuarios ADD COLUMN IF NOT EXISTS telefone TEXT;
ALTER TABLE portal_usuarios ADD COLUMN IF NOT EXISTS token TEXT;
ALTER TABLE portal_usuarios ADD COLUMN IF NOT EXISTS token_expira_em TIMESTAMPTZ;
