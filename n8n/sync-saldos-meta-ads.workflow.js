// [SYNC] Atualizar Saldos Meta Ads
// Workflow n8n — source de referência (alinhado com o que está rodando em produção)
//
// Roda a cada 1h, 08:00–17:00 horário de Brasília, seg-sex.
// Cron expression em UTC: 0 0 11-20 * * 1-5  (Brasil é UTC-3, sem horário de verão)
//
// Postgres: credential "Postgres EasyPanel" (ID uhiDzKcnDvzDL7OQ).
// Meta Graph API: credential "Facebook Graph account" (ID figqJm99B5Id1ZhO).
//
// Lê contas ativas com meta_ad_account_id preenchido, consulta /act_<id> na Graph
// API e grava cache de saldo + tipo de conta no Postgres. Auto-desliga alerta
// quando detecta conta pós-paga (funding_source_details.type != 20).
//
// IMPORTANTE: o filtro `meta_ad_account_id IS NOT NULL` é obrigatório — sem ele
// o workflow tenta `GET /act_null` e a Graph API mata todo o batch com 400.

import { workflow, node, trigger, expr } from '@n8n/workflow-sdk';

const cronTrigger = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Cron 08-17h BRT seg-sex',
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
  version: 2.6,
  config: {
    name: 'Buscar Clientes Ativos',
    parameters: {
      operation: 'executeQuery',
      query: `
SELECT id, nome, empresa, meta_ad_account_id, limite_minimo, moeda
FROM clientes_ativos
WHERE ativo = TRUE
  AND meta_ad_account_id IS NOT NULL
  AND meta_ad_account_id != ''
ORDER BY id;
`.trim(),
      options: {}
    },
    credentials: { postgres: { id: 'uhiDzKcnDvzDL7OQ', name: 'Postgres EasyPanel' } },
    position: [224, 0]
  },
  output: [{ id: 1, nome: 'Teste', empresa: 'X', meta_ad_account_id: 'act_123', limite_minimo: '50.00', moeda: 'BRL' }]
});

const consultarMeta = node({
  type: 'n8n-nodes-base.facebookGraphApi',
  version: 1,
  config: {
    name: 'Consultar Meta',
    parameters: {
      graphApiVersion: 'v19.0',
      httpRequestMethod: 'GET',
      node: expr('{{ $json.meta_ad_account_id }}'),
      options: {
        fields: {
          field: [
            { name: 'name' },
            { name: 'currency' },
            { name: 'amount_spent' },
            { name: 'is_prepay_account' },
            { name: 'account_status' },
            { name: 'funding_source_details' }
          ]
        }
      }
    },
    credentials: { facebookGraphApi: { id: 'figqJm99B5Id1ZhO', name: 'Facebook Graph account' } },
    position: [448, 0]
  },
  output: [{ name: 'Conta', currency: 'BRL', amount_spent: '0', account_status: 1 }]
});

const construirSql = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Construir SQL Update',
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: `
// Constroi o UPDATE SQL inteiro com null literal real e escape de strings.

const cliente = $('Buscar Clientes Ativos').item.json;
const meta = $json;

function parseSaldo(s) {
  if (!s) return null;
  const m = String(s).match(/[R\\$€£]\\s*([\\d.,]+)/);
  if (!m) return null;
  let num = m[1];
  const hasComma = num.includes(',');
  const hasDot = num.includes('.');
  if (hasComma && hasDot) num = num.replace(/\\./g, '').replace(',', '.');
  else if (hasComma) num = num.replace(',', '.');
  const v = parseFloat(num);
  return Number.isFinite(v) ? v : null;
}

function sqlStr(v) {
  if (v === null || v === undefined) return 'NULL';
  return "'" + String(v).replace(/'/g, "''") + "'";
}
function sqlNum(v) {
  if (v === null || v === undefined || !Number.isFinite(v)) return 'NULL';
  return String(v);
}

const erroMeta = meta.error ? (meta.error.message || JSON.stringify(meta.error)) : null;

const fundingDetails = meta.funding_source_details || {};
const fundingType = fundingDetails.type;
const displayString = fundingDetails.display_string || null;

// type === 20 = "wallet" (saldo pré-pago Meta)
const ehSaldoWallet = fundingType === 20;
const tipoConta = erroMeta
  ? 'indefinido'
  : ehSaldoWallet
    ? 'pre_paga'
    : fundingType === undefined
      ? 'indefinido'
      : 'pos_paga';

const saldoRestante = ehSaldoWallet ? parseSaldo(displayString) : null;

const sql = \`UPDATE clientes_ativos
SET ultimo_saldo = \${sqlNum(saldoRestante)},
    ultimo_tipo_conta = \${sqlStr(tipoConta)},
    ultimo_metodo_pagamento = \${sqlStr(displayString)},
    ultimo_erro = \${sqlStr(erroMeta)},
    saldo_atualizado_em = NOW(),
    receber_alerta_saldo = CASE
      WHEN \${sqlStr(tipoConta)} = 'pos_paga' AND receber_alerta_saldo = TRUE THEN FALSE
      ELSE receber_alerta_saldo
    END
WHERE id = \${parseInt(cliente.id, 10)};\`;

return { json: { sql, cliente_id: cliente.id, tipo_conta: tipoConta, saldo: saldoRestante } };
`.trim()
    },
    position: [672, 0]
  },
  output: [{ sql: 'UPDATE ...', cliente_id: 1, tipo_conta: 'pre_paga', saldo: 100 }]
});

const salvarCache = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Salvar Cache + Auto-Disable Pos-Paga',
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

export default workflow('KX5926XV6GqVxLgG', '[SYNC] Atualizar Saldos Meta Ads')
  .add(cronTrigger)
  .to(buscarClientes)
  .to(consultarMeta)
  .to(construirSql)
  .to(salvarCache);
