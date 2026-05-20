// [SYNC-GOOGLE] Atualizar Saldos Google Ads
// Workflow n8n — source de referência
// Roda a cada 1h (08-19h seg-sex): cron 0 0 8-19 * * 1-5
// Consulta AccountBudget via Google Ads API v17 (GAQL) e grava cache no Postgres

import { workflow, node, trigger } from '@n8n/workflow-sdk';

const scheduleTrigger = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Cron 1h (08-19h seg-sex)',
    parameters: {
      rule: {
        interval: [{ field: 'cronExpression', expression: '0 0 8-19 * * 1-5' }]
      }
    },
    position: [240, 300]
  },
  output: [{}]
});

const buscarClientes = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.5,
  config: {
    name: 'Buscar clientes Google Ads',
    credentials: { postgres: { id: '', name: 'Postgres EasyPanel' } },
    parameters: {
      operation: 'executeQuery',
      query: `SELECT id, google_ad_customer_id, receber_alerta_google FROM clientes_ativos WHERE ativo = true AND google_ad_customer_id IS NOT NULL AND google_ad_customer_id != ''`
    },
    position: [540, 300]
  },
  output: [{ id: 1, google_ad_customer_id: '1234567890', receber_alerta_google: true }]
});

const consultarSaldo = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Consultar saldo Google Ads',
    parameters: {
      // Credenciais injetadas via variáveis de ambiente do n8n ou hardcoded no Code node
      // MCC_ID: 8259939796
      jsCode: `
const clienteId = $input.item.json.id;
const customerId = String($input.item.json.google_ad_customer_id).replace(/-/g, '');
const mccId = '8259939796';
const devToken = 'pvJLEsosljyVML21tc9vDg';
const clientIdOAuth = '663591477567-vun0dhbvfq7ioktt6d77k8bn8hl1c96i.apps.googleusercontent.com';
const clientSecret = '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';
const refreshToken = '1//04j5C_jbJim6ACgYIARAAGAQSNwF-L9IrUO6RKbXcUbcq39LA0GbwN6EwBtzsCpfBTjvLjNVKqhcj-sJO4DS_cD_Ek2V8Q-ryoSE';

let accessToken;
try {
  const tokenRes = await $helpers.httpRequest({
    method: 'POST',
    url: 'https://oauth2.googleapis.com/token',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: \`client_id=\${encodeURIComponent(clientIdOAuth)}&client_secret=\${encodeURIComponent(clientSecret)}&refresh_token=\${encodeURIComponent(refreshToken)}&grant_type=refresh_token\`
  });
  accessToken = tokenRes.access_token;
} catch(e) {
  return [{ json: { clienteId, erro: 'Falha no OAuth2: ' + e.message, saldo: null, tipoConta: 'indefinido' } }];
}

const gaqlQuery = "SELECT customer.currency_code, account_budget.approved_spending_limit_micros, account_budget.amount_served_micros FROM account_budget WHERE account_budget.status = 'APPROVED'";

let saldo = null;
let tipoConta = 'indefinido';
let moeda = 'BRL';
let erro = null;

try {
  const res = await $helpers.httpRequest({
    method: 'POST',
    url: \`https://googleads.googleapis.com/v17/customers/\${customerId}/googleAds:search\`,
    headers: {
      'Authorization': \`Bearer \${accessToken}\`,
      'developer-token': devToken,
      'login-customer-id': mccId,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: gaqlQuery })
  });

  const results = res.results || [];
  moeda = results[0]?.customer?.currencyCode || 'BRL';

  if (results.length > 0) {
    let totalApproved = 0;
    let totalServed = 0;
    for (const row of results) {
      totalApproved += Number(row.accountBudget?.approvedSpendingLimitMicros || 0);
      totalServed += Number(row.accountBudget?.amountServedMicros || 0);
    }
    saldo = Math.max(0, (totalApproved - totalServed) / 1000000);
    tipoConta = 'pre_paga';
  } else {
    tipoConta = 'pos_paga';
  }
} catch(e) {
  erro = e.message || String(e);
}

return [{ json: { clienteId, saldo, tipoConta, moeda, erro } }];
`
    },
    position: [840, 300]
  },
  output: [{ json: { clienteId: 1, saldo: 150.5, tipoConta: 'pre_paga', moeda: 'BRL', erro: null } }]
});

const gravarSaldo = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Montar SQL de update',
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
const ehPosPaga = item.tipoConta === 'pos_paga';
const desligarAlerta = ehPosPaga ? ', receber_alerta_google = false' : '';
const sql = \`UPDATE clientes_ativos SET
  ultimo_saldo_google = \${sqlNum(item.saldo)},
  ultimo_tipo_conta_google = \${sqlStr(item.tipoConta)},
  ultimo_erro_google = \${sqlStr(item.erro)},
  saldo_google_atualizado_em = NOW()
  \${desligarAlerta}
WHERE id = \${Number(item.clienteId)}\`;
return [{ json: { sql } }];
`
    },
    position: [1140, 300]
  },
  output: [{ json: { sql: 'UPDATE clientes_ativos SET ...' } }]
});

const executarUpdate = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.5,
  config: {
    name: 'Gravar saldo no Postgres',
    credentials: { postgres: { id: '', name: 'Postgres EasyPanel' } },
    parameters: {
      operation: 'executeQuery',
      query: '={{ $json.sql }}'
    },
    position: [1440, 300]
  },
  output: [{ success: true }]
});

export default workflow('sync-google-ads', '[SYNC-GOOGLE] Atualizar Saldos Google Ads')
  .add(scheduleTrigger)
  .to(buscarClientes)
  .to(consultarSaldo)
  .to(gravarSaldo)
  .to(executarUpdate);
