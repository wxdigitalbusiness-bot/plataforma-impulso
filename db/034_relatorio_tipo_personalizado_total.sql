-- Migration 034 — Amplia os tipos de relatório público aceitos: além de
-- semanal/quinzenal/mensal, agora também "personalizado" (intervalo de datas
-- livre) e "total" (desde o início do cliente na agência até ontem).

ALTER TABLE relatorios_publicos DROP CONSTRAINT IF EXISTS relatorios_publicos_tipo_check;

ALTER TABLE relatorios_publicos ADD CONSTRAINT relatorios_publicos_tipo_check
  CHECK (tipo IN ('semanal', 'quinzenal', 'mensal', 'personalizado', 'total'));
