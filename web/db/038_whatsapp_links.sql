-- Links de WhatsApp por cliente — múltiplos links com mensagens distintas
CREATE TABLE IF NOT EXISTS crm_whatsapp_links (
  id         BIGSERIAL    PRIMARY KEY,
  cliente_id INT          NOT NULL,
  nome       TEXT         NOT NULL,
  wa_numero  TEXT         NOT NULL,
  mensagem   TEXT         NOT NULL DEFAULT '',
  slug       TEXT         NOT NULL UNIQUE,
  ativo      BOOLEAN      NOT NULL DEFAULT true,
  criado_em  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_links_cliente ON crm_whatsapp_links (cliente_id);
