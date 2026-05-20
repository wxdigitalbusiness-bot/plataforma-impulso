// [ALERTA-GOOGLE] Saldo Baixo Google Ads
// Workflow n8n — source de referência
// Roda a cada 2h com offset 5min (08:05, 10:05, 12:05, 14:05, 16:05 seg-sex)
// Lê cache do Postgres e envia alertas WhatsApp via Evolution API

import { workflow, node, trigger } from '@n8n/workflow-sdk';

const scheduleTrigger = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Cron 2h offset 5min (08:05-17:05 seg-sex)',
    parameters: {
      rule: {
        interval: [{ field: 'cronExpression', expression: '0 5 8,10,12,14,16 * * 1-5' }]
      }
    },
    position: [240, 300]
  },
  output: [{}]
});

const buscarAlertasPendentes = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.5,
  config: {
    name: 'Buscar clientes com saldo critico Google',
    credentials: { postgres: { id: '', name: 'Postgres EasyPanel' } },
    parameters: {
      operation: 'executeQuery',
      query: `SELECT
        id, nome, empresa, whatsapp_alerta,
        ultimo_saldo_google, limite_minimo_google, moeda,
        ultimo_tipo_conta_google, ultimo_erro_google
      FROM clientes_ativos
      WHERE ativo = true
        AND receber_alerta_google = true
        AND whatsapp_alerta IS NOT NULL
        AND ultimo_tipo_conta_google = 'pre_paga'
        AND ultimo_saldo_google IS NOT NULL
        AND ultimo_saldo_google < limite_minimo_google`
    },
    position: [540, 300]
  },
  output: [{ id: 1, nome: 'Cliente Teste', whatsapp_alerta: '5511999999999', ultimo_saldo_google: 50, limite_minimo_google: 100, moeda: 'BRL' }]
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
`
    },
    position: [840, 300]
  },
  output: [{ json: { mensagem: 'Alerta...', whatsapp_alerta: '5511999999999' } }]
});

const enviarWhatsApp = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Enviar WhatsApp (Evolution API)',
    credentials: { httpHeaderAuth: { id: '', name: 'Evolution account' } },
    parameters: {
      method: 'POST',
      url: 'https://evolution.wxdigitalbussines.com/message/sendText/Murillo',
      sendHeaders: true,
      headerParameters: {
        parameters: [{ name: 'Content-Type', value: 'application/json' }]
      },
      sendBody: true,
      specifyBody: 'string',
      body: '={"number":"{{ $json.whatsapp_alerta }}","text":"{{ $json.mensagem }}"}'
    },
    position: [1140, 300]
  },
  output: [{ key: 'abc123' }]
});

const registrarLog = node({
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
`
    },
    position: [1440, 300]
  },
  output: [{ json: { sql: 'INSERT ...' } }]
});

const gravarLog = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.5,
  config: {
    name: 'Gravar log no Postgres',
    credentials: { postgres: { id: '', name: 'Postgres EasyPanel' } },
    parameters: {
      operation: 'executeQuery',
      query: '={{ $json.sql }}'
    },
    position: [1740, 300]
  },
  output: [{ success: true }]
});

export default workflow('alerta-google-ads', '[ALERTA-GOOGLE] Saldo Baixo Google Ads')
  .add(scheduleTrigger)
  .to(buscarAlertasPendentes)
  .to(montarMensagem)
  .to(enviarWhatsApp)
  .to(registrarLog)
  .to(gravarLog);
