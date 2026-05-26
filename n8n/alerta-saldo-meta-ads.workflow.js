// [ALERTA] Saldo Baixo Meta Ads
// Workflow n8n — source de referência (alinhado com o que está rodando em produção)
//
// Roda a cada 2h com offset de 5min, 08:05–16:05 horário de Brasília, seg-sex.
// Cron expression em UTC: 0 5 11,13,15,17,19 * * 1-5  (Brasil é UTC-3, sem DST)
//
// Postgres: credential "Postgres EasyPanel" (ID uhiDzKcnDvzDL7OQ).
//
// Lê cache de saldo Meta Ads do Postgres (gravado pelo [SYNC] Meta) + JOIN clientes
// para puxar whatsapp_alerta e empresa do cliente parent. Envia alerta WhatsApp via
// Evolution API e grava log em alertas_saldo_log. Inclui deduplicação por dia.

import { workflow, node, trigger, expr } from '@n8n/workflow-sdk';

const cronTrigger = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Cron 08:05-16:05 BRT (2h, seg-sex)',
    parameters: {
      rule: {
        interval: [{ field: 'cronExpression', expression: '0 5 11,13,15,17,19 * * 1-5' }]
      }
    },
    position: [0, 0]
  },
  output: [{}]
});

const buscarParaAlertar = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Buscar Para Alertar',
    parameters: {
      operation: 'executeQuery',
      query: `
SELECT
  ca.id AS cliente_id,
  ca.nome,
  COALESCE(c.empresa, ca.empresa) AS empresa,
  ca.meta_ad_account_id,
  COALESCE(c.whatsapp_alerta, ca.whatsapp_alerta) AS whatsapp_alerta,
  ca.limite_minimo::float8 AS limite_minimo,
  ca.moeda,
  ca.ultimo_saldo::float8 AS saldo_restante,
  ca.ultimo_metodo_pagamento
FROM clientes_ativos ca
LEFT JOIN clientes c ON c.id = ca.cliente_id
WHERE ca.ativo = TRUE
  AND ca.receber_alerta_saldo = TRUE
  AND COALESCE(c.whatsapp_alerta, ca.whatsapp_alerta) IS NOT NULL
  AND ca.ultimo_tipo_conta = 'pre_paga'
  AND ca.ultimo_saldo IS NOT NULL
  AND ca.ultimo_saldo < ca.limite_minimo
  AND NOT EXISTS (
    SELECT 1 FROM alertas_saldo_log l
    WHERE l.cliente_id = ca.id
      AND l.status = 'enviado'
      AND DATE(l.enviado_em AT TIME ZONE 'America/Sao_Paulo')
        = DATE(NOW() AT TIME ZONE 'America/Sao_Paulo')
  );
`.trim(),
      options: {}
    },
    credentials: { postgres: { id: 'uhiDzKcnDvzDL7OQ', name: 'Postgres EasyPanel' } },
    position: [224, 0]
  },
  output: [{ cliente_id: 1, nome: 'Teste', empresa: 'X', meta_ad_account_id: 'act_123', whatsapp_alerta: '5511999999999', limite_minimo: 100, moeda: 'BRL', saldo_restante: 50, ultimo_metodo_pagamento: null }]
});

const enviarWhatsApp = node({
  type: 'n8n-nodes-evolution-api.evolutionApi',
  version: 1,
  config: {
    name: 'Enviar WhatsApp (Evolution)',
    parameters: {
      resource: 'messages-api',
      operation: 'send-text',
      instanceName: 'Murillo',
      remoteJid: expr('{{ $json.whatsapp_alerta }}'),
      messageText: expr(`🚨 *Alerta de Saldo Baixo - Meta Ads*

Cliente: {{ $json.nome }} ({{ $json.empresa }})
Conta: {{ $json.meta_ad_account_id }}

💰 Saldo restante: {{ $json.moeda }} {{ $json.saldo_restante.toFixed(2) }}
⚠️ Limite configurado: {{ $json.moeda }} {{ $json.limite_minimo.toFixed(2) }}

Recomendamos efetuar a recarga o quanto antes para evitar interrupção das campanhas.`)
    },
    position: [448, 0]
  },
  output: [{ key: { remoteJid: 'x' }, status: 'PENDING' }]
});

const construirSqlLog = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Construir SQL Log',
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: `
const item = $('Buscar Para Alertar').item.json;
const resp = $json;

function sqlStr(v) {
  if (v === null || v === undefined) return 'NULL';
  return "'" + String(v).replace(/'/g, "''") + "'";
}
function sqlNum(v) {
  if (v === null || v === undefined || !Number.isFinite(v)) return 'NULL';
  return String(v);
}

const sucesso = !!(resp && (resp.success || resp.key || resp.messageId ||
  (resp.data && (resp.data.key || resp.data.status === 'PENDING'))));
const status = sucesso ? 'enviado' : 'falhou';
const erro = sucesso ? null : JSON.stringify(resp || {}).slice(0, 500);

const sql = \`INSERT INTO alertas_saldo_log
  (cliente_id, saldo_no_momento, limite_no_momento, whatsapp_destino, status, erro)
VALUES (\${parseInt(item.cliente_id, 10)}, \${sqlNum(item.saldo_restante)}, \${sqlNum(item.limite_minimo)}, \${sqlStr(item.whatsapp_alerta)}, \${sqlStr(status)}, \${sqlStr(erro)});\`;

return { json: { sql } };
`.trim()
    },
    position: [672, 0]
  },
  output: [{ sql: 'INSERT ...' }]
});

const registrarAlerta = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Registrar Alerta Enviado',
    parameters: {
      operation: 'executeQuery',
      query: expr('{{ $json.sql }}'),
      options: {}
    },
    credentials: { postgres: { id: 'uhiDzKcnDvzDL7OQ', name: 'Postgres EasyPanel' } },
    position: [896, 0]
  },
  output: [{ success: true }]
});

export default workflow('tt2slbKmH0OpuoYn', '[ALERTA] Saldo Baixo Meta Ads')
  .add(cronTrigger)
  .to(buscarParaAlertar)
  .to(enviarWhatsApp)
  .to(construirSqlLog)
  .to(registrarAlerta);
