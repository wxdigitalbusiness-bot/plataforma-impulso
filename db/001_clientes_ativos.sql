-- Plataforma Impulso — Fase 1
-- Tabela de clientes ativos da agência + flag de alerta de saldo Meta Ads

CREATE TABLE IF NOT EXISTS clientes_ativos (
  id                      SERIAL PRIMARY KEY,
  nome                    TEXT        NOT NULL,
  empresa                 TEXT        NOT NULL,
  meta_ad_account_id      TEXT        NOT NULL,
  meta_access_token       TEXT        NOT NULL,
  whatsapp_alerta         TEXT,
  limite_minimo           NUMERIC(12,2) NOT NULL DEFAULT 100.00,
  moeda                   TEXT        NOT NULL DEFAULT 'BRL',
  receber_alerta_saldo    BOOLEAN     NOT NULL DEFAULT TRUE,
  ativo                   BOOLEAN     NOT NULL DEFAULT TRUE,
  criado_em               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT clientes_ativos_meta_ad_account_id_uq UNIQUE (meta_ad_account_id)
);

CREATE INDEX IF NOT EXISTS idx_clientes_ativos_ativo
  ON clientes_ativos (ativo)
  WHERE ativo = TRUE;

CREATE INDEX IF NOT EXISTS idx_clientes_ativos_receber_alerta
  ON clientes_ativos (receber_alerta_saldo)
  WHERE receber_alerta_saldo = TRUE;

-- Log de notificações já enviadas (evita duplicar alerta no mesmo dia)
CREATE TABLE IF NOT EXISTS alertas_saldo_log (
  id                  SERIAL PRIMARY KEY,
  cliente_id          INTEGER     NOT NULL REFERENCES clientes_ativos(id) ON DELETE CASCADE,
  saldo_no_momento    NUMERIC(12,2) NOT NULL,
  limite_no_momento   NUMERIC(12,2) NOT NULL,
  whatsapp_destino    TEXT        NOT NULL,
  status              TEXT        NOT NULL,           -- 'enviado' | 'falhou'
  erro                TEXT,
  enviado_em          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alertas_saldo_log_cliente_dia
  ON alertas_saldo_log (cliente_id, enviado_em);

-- Trigger pra atualizar atualizado_em automaticamente
CREATE OR REPLACE FUNCTION set_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_clientes_ativos_atualizado_em ON clientes_ativos;
CREATE TRIGGER trg_clientes_ativos_atualizado_em
  BEFORE UPDATE ON clientes_ativos
  FOR EACH ROW
  EXECUTE FUNCTION set_atualizado_em();
