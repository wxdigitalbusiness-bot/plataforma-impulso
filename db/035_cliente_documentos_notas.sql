-- Migration 035 — Notas de texto na aba Documentos, sem precisar de arquivo.
-- url/tamanho passam a ser opcionais (uma nota não tem arquivo); conteudo
-- guarda o texto da nota. tipo = 'nota' identifica esse tipo de registro.

ALTER TABLE cliente_documentos ALTER COLUMN url DROP NOT NULL;
ALTER TABLE cliente_documentos ALTER COLUMN tamanho DROP NOT NULL;
ALTER TABLE cliente_documentos ADD COLUMN IF NOT EXISTS conteudo TEXT;
