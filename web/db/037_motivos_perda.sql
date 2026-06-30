-- Motivos de perda customizados por cliente
CREATE TABLE IF NOT EXISTS crm_motivos_perda (
  id         BIGSERIAL PRIMARY KEY,
  client_key TEXT        NOT NULL,
  motivo     TEXT        NOT NULL,
  ativo      BOOLEAN     NOT NULL DEFAULT true,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_key, motivo)
);

CREATE INDEX IF NOT EXISTS idx_motivos_perda_client_key
  ON crm_motivos_perda (client_key);

-- Motivo selecionado no momento em que o lead foi marcado como perdido
ALTER TABLE fb_leads
  ADD COLUMN IF NOT EXISTS motivo_perda TEXT;
