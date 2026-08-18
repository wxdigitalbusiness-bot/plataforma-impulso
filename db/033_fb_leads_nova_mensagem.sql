-- Migration 033 — Sinalizador de nova mensagem em lead já classificado
-- Antes: lead que já tinha sido classificado e mandava nova mensagem era
-- resetado pra etapa "Não Classificado" automaticamente. Agora só sinaliza
-- no card (ícone), sem mover o lead de etapa — preserva o progresso.

ALTER TABLE fb_leads ADD COLUMN IF NOT EXISTS nova_mensagem BOOLEAN NOT NULL DEFAULT false;
