// [ALERTA-GOOGLE] Saldo Baixo Google Ads
// Workflow n8n — source de referência (alinhado com o que está rodando em produção)
//
// Roda a cada 2h com offset de 5min, 08:05–16:05 horário de Brasília, seg-sex.
// Cron expression em UTC: 0 5 11,13,15,17,19 * * 1-5  (Brasil é UTC-3, sem horário de verão)
//
// Postgres: credential "Postgres EasyPanel" (ID uhiDzKcnDvzDL7OQ).
//
// Lê cache de saldo do Postgres (gravado pelo SYNC-GOOGLE) e envia alerta
// WhatsApp via Evolution API para clientes com saldo pré-pago abaixo do limite.
// Grava log em alertas_saldo_log.

import { workflow, node, trigger, expr } from '@n8n/workflow-sdk';

const cronTrigger = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Cron 2h offset 5min (08:05-16:05 BRT seg-sex)',
    parameters: {
      rule: {
        interval: [{ field: 'cronExpression', expression: '0 5 11,13,15,17,19 * * 1-5' }]
      }
    },
    position: [0, 0]
  },
  output: [{}]
});

const buscarClientes = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.5,
  config: {
    name: 'Buscar clientes com saldo critico Google',
    parameters: {
      operation: 'executeQuery',
      query: `
SELECT
  ca.id, ca.nome,
  COALESCE(c.empresa, ca.empresa) AS empresa,
  COALESCE(c.whatsapp_alerta, ca.whatsapp_alerta) AS whatsapp_alerta,
  ca.ultimo_saldo_google, ca.limite_minimo_google, ca.moeda,
  ca.ultimo_tipo_conta_google, ca.ultimo_erro_google
FROM clientes_ativos ca
LEFT JOIN clientes c ON c.id = ca.cliente_id
WHERE ca.ativo = true
  AND ca.receber_alerta_google = true
  AND COALESCE(c.whatsapp_alerta, ca.whatsapp_alerta) IS NOT NULL
  AND ca.ultimo_tipo_conta_google = 'pre_paga'
  AND ca.ultimo_saldo_google IS NOT NULL
  AND ca.ultimo_saldo_google < ca.limite_minimo_google
`.trim(),
      options: {}
    },
    credentials: { postgres: { id: 'uhiDzKcnDvzDL7OQ', name: 'Postgres EasyPanel' } },
    position: [224, 0]
  },
  output: [{ id: 1, nome: 'Teste', empresa: 'X', whatsapp_alerta: '5511999999999', ultimo_saldo_google: '50.00', limite_minimo_google: '100.00', moeda: 'BRL', ultimo_tipo_conta_google: 'pre_paga', ultimo_erro_google: null }]
});

const montarMensagem = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Montar mensagem WhatsApp',
    parameters: {
      jsCode: `
const item = $input.item.json;

function formatBRL(valor, moeda) {
  moeda = moeda || 'BRL';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: moeda }).format(Number(valor));
}

const saldo = formatBRL(item.ultimo_saldo_google, item.moeda);
const limite = formatBRL(item.limite_minimo_google, item.moeda);

const mensagem = [
  '🔴 *Alerta de saldo Google Ads*',
  '',
  \`*Cliente:* \${item.nome}\`,
  \`*Empresa:* \${item.empresa}\`,
  '',
  \`*Saldo atual:* \${saldo}\`,
  \`*Limite mínimo:* \${limite}\`,
  '',
  'Por favor, recarregue a conta Google Ads para evitar interrupção das campanhas.'
].join('\\n');

return [{ json: { ...item, mensagem } }];
`.trim()
    },
    position: [448, 0]
  },
  output: [{ id: 1, nome: 'Teste', empresa: 'X', whatsapp_alerta: '5511999999999', ultimo_saldo_google: '50.00', limite_minimo_google: '100.00', moeda: 'BRL', mensagem: 'alerta' }]
});

const enviarWhatsApp = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Enviar WhatsApp (Evolution API)',
    parameters: {
      method: 'POST',
      url: 'https://evolution.wxdigitalbussines.com/message/sendText/Murillo',
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'Content-Type', value: 'application/json' }
        ]
      },
      sendBody: true,
      specifyBody: 'string',
      body: expr('{"number":"{{ $json.whatsapp_alerta }}","text":"{{ $json.mensagem }}"}')
    },
    position: [672, 0]
  },
  output: [{ key: { remoteJid: '5511999999999@s.whatsapp.net' }, status: 'PENDING' }]
});

const montarSqlLog = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Montar SQL log',
    parameters: {
      jsCode: `
const item = $input.item.json;

function sqlStr(v) {
  if (v === null || v === undefined) return 'NULL';
  return "'" + String(v).replace(/'/g, "''") + "'";
}
function sqlNum(v) {
  if (v === null || v === undefined) return 'NULL';
  const n = parseFloat(v);
  return isNaN(n) ? 'NULL' : String(n);
}

const sql = \`INSERT INTO alertas_saldo_log
  (cliente_id, saldo_no_momento, limite_no_momento, whatsapp_destino, status, enviado_em)
VALUES (
  \${Number(item.id)},
  \${sqlNum(item.ultimo_saldo_google)},
  \${sqlNum(item.limite_minimo_google)},
  \${sqlStr(item.whatsapp_alerta)},
  'enviado_google',
  NOW()
)\`;

return [{ json: { sql } }];
`.trim()
    },
    position: [896, 0]
  },
  output: [{ sql: 'INSERT INTO alertas_saldo_log ...' }]
});

const gravarLog = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.5,
  config: {
    name: 'Gravar log no Postgres',
    parameters: {
      operation: 'executeQuery',
      query: expr('{{ $json.sql }}'),
      options: {}
    },
    credentials: { postgres: { id: 'uhiDzKcnDvzDL7OQ', name: 'Postgres EasyPanel' } },
    position: [1120, 0]
  },
  output: [{ success: true }]
});

export default workflow('apPNDHLmv9FjIgDi', '[ALERTA-GOOGLE] Saldo Baixo Google Ads')
  .add(cronTrigger)
  .to(buscarClientes)
  .to(montarMensagem)
  .to(enviarWhatsApp)
  .to(montarSqlLog)
  .to(gravarLog);
