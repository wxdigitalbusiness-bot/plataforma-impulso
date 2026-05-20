import {
  workflow,
  node,
  trigger,
  ifElse,
  newCredential,
  sticky,
  expr,
} from '@n8n/workflow-sdk';

const scheduleTrigger = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Cron 08-17 (3h, seg-sex)',
    parameters: {
      rule: {
        interval: [
          {
            field: 'cronExpression',
            expression: '0 0 8,11,14,17 * * 1-5',
          },
        ],
      },
    },
    position: [240, 300],
  },
  output: [{}],
});

const buscarClientes = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Buscar Clientes Ativos',
    parameters: {
      operation: 'executeQuery',
      query: `SELECT c.id,
       c.nome,
       c.empresa,
       c.meta_ad_account_id,
       c.meta_access_token,
       c.whatsapp_alerta,
       c.limite_minimo,
       c.moeda
FROM clientes_ativos c
WHERE c.ativo = TRUE
  AND c.receber_alerta_saldo = TRUE
  AND c.whatsapp_alerta IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM alertas_saldo_log l
    WHERE l.cliente_id = c.id
      AND l.status = 'enviado'
      AND DATE(l.enviado_em AT TIME ZONE 'America/Sao_Paulo')
        = DATE(NOW() AT TIME ZONE 'America/Sao_Paulo')
  );`,
      options: {},
    },
    credentials: { postgres: newCredential('Postgres Impulso') },
    position: [460, 300],
  },
  output: [
    {
      id: 1,
      nome: 'Cliente Exemplo',
      empresa: 'Empresa X',
      meta_ad_account_id: 'act_1234567890',
      meta_access_token: 'EAABs...',
      whatsapp_alerta: '5511999999999',
      limite_minimo: '100.00',
      moeda: 'BRL',
    },
  ],
});

const consultarMeta = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Consultar Saldo Meta Ads',
    parameters: {
      method: 'GET',
      url: '=https://graph.facebook.com/v19.0/{{ $json.meta_ad_account_id }}',
      sendQuery: true,
      specifyQuery: 'keypair',
      queryParameters: {
        parameters: [
          {
            name: 'fields',
            value: 'balance,amount_spent,spend_cap,currency,account_status,name',
          },
          {
            name: 'access_token',
            value: '={{ $json.meta_access_token }}',
          },
        ],
      },
      options: {
        response: {
          response: {
            neverError: true,
            responseFormat: 'json',
            fullResponse: false,
          },
        },
        timeout: 15000,
      },
    },
    position: [680, 300],
  },
  output: [
    {
      balance: '5000',
      amount_spent: '0',
      spend_cap: '0',
      currency: 'BRL',
      account_status: 1,
      name: 'Conta Exemplo',
      id: 'act_1234567890',
    },
  ],
});

const calcularSaldo = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Calcular Saldo Restante',
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: `// Junta dados do cliente (Postgres) com resposta Meta Ads
const cliente = $('Buscar Clientes Ativos').item.json;
const meta = $json;

// Meta retorna valores em "minor units" (centavos para BRL/USD)
const toFloat = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  return parseFloat(String(v));
};

const balanceMinor = toFloat(meta.balance);
const spendCapMinor = toFloat(meta.spend_cap);
const amountSpentMinor = toFloat(meta.amount_spent);
const limiteMinimo = toFloat(cliente.limite_minimo);

// Regra:
//  - Conta pré-paga: usa balance (saldo carregado)
//  - Conta com spend_cap (limite de gasto): cap - amount_spent
//  - Sem nenhum dos dois: pós-paga sem limite, não alertamos
let saldoRestante = null;
let origemSaldo = null;
if (balanceMinor > 0) {
  saldoRestante = balanceMinor / 100;
  origemSaldo = 'prepaid_balance';
} else if (spendCapMinor > 0) {
  saldoRestante = Math.max(0, (spendCapMinor - amountSpentMinor) / 100);
  origemSaldo = 'spend_cap_restante';
}

const erroMeta = meta.error ? (meta.error.message || JSON.stringify(meta.error)) : null;
const saldoAbaixoLimite = !erroMeta && saldoRestante !== null && saldoRestante < limiteMinimo;

return {
  json: {
    cliente_id: cliente.id,
    nome: cliente.nome,
    empresa: cliente.empresa,
    whatsapp_alerta: cliente.whatsapp_alerta,
    meta_ad_account_id: cliente.meta_ad_account_id,
    limite_minimo: limiteMinimo,
    moeda: cliente.moeda,
    conta_meta_nome: meta.name || null,
    saldo_restante: saldoRestante,
    origem_saldo: origemSaldo,
    saldo_abaixo_limite: saldoAbaixoLimite,
    erro_meta: erroMeta,
  },
};`,
    },
    position: [900, 300],
  },
  output: [
    {
      cliente_id: 1,
      nome: 'Cliente Exemplo',
      whatsapp_alerta: '5511999999999',
      limite_minimo: 100,
      moeda: 'BRL',
      saldo_restante: 50,
      saldo_abaixo_limite: true,
      erro_meta: null,
    },
  ],
});

const ifSaldoBaixo = ifElse({
  type: 'n8n-nodes-base.if',
  version: 2.3,
  config: {
    name: 'Saldo abaixo do limite?',
    parameters: {
      conditions: {
        combinator: 'and',
        options: {
          caseSensitive: true,
          leftValue: '',
          typeValidation: 'strict',
          version: 2,
        },
        conditions: [
          {
            id: 'cond-saldo-baixo',
            leftValue: '={{ $json.saldo_abaixo_limite }}',
            rightValue: true,
            operator: { type: 'boolean', operation: 'true', singleValue: true },
          },
        ],
      },
    },
    position: [1120, 300],
  },
});

const enviarWhatsapp = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Enviar WhatsApp (Evolution)',
    parameters: {
      method: 'POST',
      // IMPORTANTE: ajustar URL/instância da Evolution depois de criado
      url: '=https://SUA-EVOLUTION-URL/message/sendText/SUA_INSTANCIA',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: `={{ JSON.stringify({
  number: $json.whatsapp_alerta,
  text: "🚨 *Alerta de Saldo Baixo - Meta Ads*\\n\\n" +
        "Cliente: " + $json.nome + " (" + $json.empresa + ")\\n" +
        "Conta: " + ($json.conta_meta_nome || $json.meta_ad_account_id) + "\\n\\n" +
        "💰 Saldo restante: " + $json.moeda + " " + $json.saldo_restante.toFixed(2) + "\\n" +
        "⚠️ Limite configurado: " + $json.moeda + " " + $json.limite_minimo.toFixed(2) + "\\n\\n" +
        "Recomendamos efetuar a recarga o quanto antes para evitar interrupção das campanhas."
}) }}`,
      sendHeaders: true,
      specifyHeaders: 'keypair',
      headerParameters: {
        parameters: [{ name: 'Content-Type', value: 'application/json' }],
      },
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      options: {
        response: {
          response: { neverError: true, responseFormat: 'json', fullResponse: false },
        },
        timeout: 15000,
      },
    },
    credentials: { httpHeaderAuth: newCredential('Evolution API') },
    position: [1340, 200],
  },
  output: [{ status: 'PENDING', messageId: 'abc123' }],
});

const salvarLog = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Registrar Alerta Enviado',
    parameters: {
      operation: 'executeQuery',
      query: `INSERT INTO alertas_saldo_log
  (cliente_id, saldo_no_momento, limite_no_momento, whatsapp_destino, status, erro)
VALUES ($1, $2, $3, $4, $5, $6);`,
      options: {
        queryReplacement:
          "={{ $('Calcular Saldo Restante').item.json.cliente_id }},={{ $('Calcular Saldo Restante').item.json.saldo_restante }},={{ $('Calcular Saldo Restante').item.json.limite_minimo }},={{ $('Calcular Saldo Restante').item.json.whatsapp_alerta }},={{ $json && ($json.status === 'PENDING' || $json.key || $json.messageId) ? 'enviado' : 'falhou' }},={{ $json && $json.error ? JSON.stringify($json.error) : null }}",
      },
    },
    credentials: { postgres: newCredential('Postgres Impulso') },
    position: [1560, 200],
  },
});

const notaSticky = sticky({
  config: {
    name: 'Documentação',
    parameters: {
      content: `## [ALERTA] Saldo Baixo Meta Ads

**Roda:** seg-sex às 08, 11, 14 e 17h (America/Sao_Paulo)

**Fluxo:**
1. Busca clientes ativos com \`receber_alerta_saldo = TRUE\` que **ainda não receberam alerta hoje**
2. Para cada cliente, consulta a Graph API da Meta (\`balance\`, \`spend_cap\`, \`amount_spent\`)
3. Calcula saldo restante (pré-pago ou cap - gasto)
4. Se saldo < \`limite_minimo\` → manda WhatsApp via Evolution + grava log

**Antes de ativar:**
- Configure credencial **Postgres Impulso** (apontando pra base com a tabela \`clientes_ativos\`)
- Configure credencial **Evolution API** (Header Auth: header \`apikey\` com seu token)
- Edite a URL do node "Enviar WhatsApp" com sua URL/instância Evolution
- Cadastre ao menos 1 cliente na tabela com token Meta válido`,
      height: 380,
      width: 420,
    },
    position: [240, 540],
  },
});

export default workflow('alerta-saldo-meta-ads', '[ALERTA] Saldo Baixo Meta Ads')
  .add(scheduleTrigger)
  .to(
    buscarClientes
      .to(consultarMeta)
      .to(calcularSaldo)
      .to(
        ifSaldoBaixo
          .onTrue(enviarWhatsapp.to(salvarLog))
      )
  )
  .add(notaSticky);
