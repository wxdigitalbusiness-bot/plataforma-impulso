// [SYNC-GOOGLE] Atualizar Saldos Google Ads
// Workflow n8n — source de referência (alinhado com o que está rodando em produção)
//
// Roda a cada 1h, 08:00–17:00 horário de Brasília, seg-sex.
// Cron expression em UTC: 0 0 11-20 * * 1-5  (Brasil é UTC-3, sem horário de verão)
//
// Autenticação OAuth: gerenciada pela n8n Credential "Google Ads OAuth2" (ID BrEUCO5EzTn5Gbb3).
// n8n cuida do refresh do access_token automaticamente — não há node "Obter OAuth Token".
//
// Postgres: credential "Postgres EasyPanel" (ID uhiDzKcnDvzDL7OQ).
//
// Fórmula de saldo: (adjustedSpendingLimit - amountServed × 1.10) / 1_000_000
//   × 1.10 = tributos BR (ISS 5% + PIS/COFINS ~4% + outras ≈ 10%)

import { workflow, node, trigger, expr } from '@n8n/workflow-sdk';

const cronTrigger = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Cron 1h (08-17h BRT seg-sex)',
    parameters: {
      rule: {
        interval: [{ field: 'cronExpression', expression: '0 0 11-20 * * 1-5' }]
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
    name: 'Buscar clientes Google Ads',
    parameters: {
      operation: 'executeQuery',
      query: "SELECT id, google_ad_customer_id, google_ads_mcc_id FROM clientes_ativos WHERE ativo = true AND google_ad_customer_id IS NOT NULL AND google_ad_customer_id != ''",
      options: {}
    },
    credentials: { postgres: { id: 'uhiDzKcnDvzDL7OQ', name: 'Postgres EasyPanel' } },
    position: [224, 0]
  },
  output: [{ id: 1, google_ad_customer_id: '1234567890', google_ads_mcc_id: null }]
});

const prepararDados = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Preparar dados cliente',
    parameters: {
      mode: 'runOnceForEachItem',
      jsCode: `
const cliente = $input.item.json;
const MCC_PADRAO = '8259939796';
const customerId = String(cliente.google_ad_customer_id).replace(/-/g, '');
const loginCustomerId = (cliente.google_ads_mcc_id && String(cliente.google_ads_mcc_id).trim() !== '')
  ? String(cliente.google_ads_mcc_id).replace(/-/g, '')
  : MCC_PADRAO;
return { json: { clienteId: cliente.id, customerId, loginCustomerId } };
`.trim()
    },
    position: [448, 0]
  },
  output: [{ clienteId: 1, customerId: '1234567890', loginCustomerId: '8259939796' }]
});

const consultarAds = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.3,
  config: {
    name: 'Consultar Google Ads API',
    parameters: {
      method: 'POST',
      url: expr('https://googleads.googleapis.com/v20/customers/{{ $json.customerId }}/googleAds:search'),
      authentication: 'genericCredentialType',
      genericAuthType: 'oAuth2Api',
      sendHeaders: true,
      headerParameters: {
        parameters: [
          // Substituir pelo developer-token real ao reimportar (preservado no n8n em produção)
          { name: 'developer-token',   value: '<<GOOGLE_ADS_DEVELOPER_TOKEN>>' },
          { name: 'login-customer-id', value: expr('{{ $json.loginCustomerId }}') },
          { name: 'Content-Type',      value: 'application/json' }
        ]
      },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: `{ "query": "SELECT customer.currency_code, account_budget.approved_spending_limit_micros, account_budget.adjusted_spending_limit_micros, account_budget.amount_served_micros FROM account_budget WHERE account_budget.status = 'APPROVED'" }`,
      options: {
        response: { response: { neverError: true } }
      }
    },
    credentials: { oAuth2Api: { id: 'BrEUCO5EzTn5Gbb3', name: 'Google Ads OAuth2' } },
    position: [672, 0]
  },
  output: [{ results: [] }]
});

const processarResultado = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Processar resultado',
    parameters: {
      mode: 'runOnceForEachItem',
      jsCode: `
const resposta = $input.item.json;
const clienteId = $('Preparar dados cliente').item.json.clienteId;

// Taxa de tributos do Google Ads no Brasil:
// ISS (5%) + PIS/COFINS (~4%) + outras ≈ 10%
// amountServedMicros = custo líquido SEM impostos
var TAX_RATE = 0.10;

var saldo = null;
var tipoConta = 'indefinido';
var moeda = 'BRL';
var erro = null;

if (resposta.error) {
  erro = JSON.stringify(resposta.error);
} else {
  var results = resposta.results || [];
  moeda = (results[0] && results[0].customer && results[0].customer.currencyCode)
    ? results[0].customer.currencyCode : 'BRL';

  if (results.length === 0) {
    tipoConta = 'pos_paga';
  } else {
    var temLimitePrepago = false;
    for (var i = 0; i < results.length; i++) {
      var row = results[i];
      if (row.accountBudget &&
          row.accountBudget.approvedSpendingLimitMicros &&
          Number(row.accountBudget.approvedSpendingLimitMicros) > 0) {
        temLimitePrepago = true;
        break;
      }
    }

    if (!temLimitePrepago) {
      tipoConta = 'pos_paga';
    } else {
      var totalAdjusted = 0;
      var totalServed   = 0;
      for (var j = 0; j < results.length; j++) {
        var b = results[j].accountBudget;
        if (!b) continue;
        var limit = b.adjustedSpendingLimitMicros
          ? Number(b.adjustedSpendingLimitMicros)
          : Number(b.approvedSpendingLimitMicros || 0);
        totalAdjusted += limit;
        totalServed   += Number(b.amountServedMicros || 0);
      }
      var raw = (totalAdjusted - totalServed * (1 + TAX_RATE)) / 1000000;
      saldo = Math.max(0, Math.round(raw * 100) / 100);
      tipoConta = 'pre_paga';
    }
  }
}

return { json: { clienteId, saldo, tipoConta, moeda, erro } };
`.trim()
    },
    position: [896, 0]
  },
  output: [{ clienteId: 1, saldo: 150.5, tipoConta: 'pre_paga', moeda: 'BRL', erro: null }]
});

const montarSql = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Montar SQL de update',
    parameters: {
      mode: 'runOnceForEachItem',
      jsCode: `
const item = $input.item.json;

function sqlStr(v) {
  if (v === null || v === undefined) return 'NULL';
  return "'" + String(v).replace(/'/g, "''") + "'";
}
function sqlNum(v) {
  if (v === null || v === undefined) return 'NULL';
  var n = parseFloat(v);
  return isNaN(n) ? 'NULL' : n.toFixed(2);
}

const desligarAlerta = (item.tipoConta === 'pos_paga') ? ', receber_alerta_google = false' : '';

const sql = 'UPDATE clientes_ativos SET'
  + ' ultimo_saldo_google = '        + sqlNum(item.saldo)     + ','
  + ' ultimo_tipo_conta_google = '   + sqlStr(item.tipoConta) + ','
  + ' ultimo_erro_google = '         + sqlStr(item.erro)      + ','
  + ' saldo_google_atualizado_em = NOW()'
  + desligarAlerta
  + ' WHERE id = ' + Number(item.clienteId);

return { json: { sql } };
`.trim()
    },
    position: [1120, 0]
  },
  output: [{ sql: 'UPDATE clientes_ativos SET ...' }]
});

const gravarSaldo = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.5,
  config: {
    name: 'Gravar saldo no Postgres',
    parameters: {
      operation: 'executeQuery',
      query: expr('{{ $json.sql }}'),
      options: {}
    },
    credentials: { postgres: { id: 'uhiDzKcnDvzDL7OQ', name: 'Postgres EasyPanel' } },
    position: [1344, 0]
  },
  output: [{ success: true }]
});

export default workflow('NHp6jnXas9xE1LQf', '[SYNC-GOOGLE] Atualizar Saldos Google Ads')
  .add(cronTrigger)
  .to(buscarClientes)
  .to(prepararDados)
  .to(consultarAds)
  .to(processarResultado)
  .to(montarSql)
  .to(gravarSaldo);
