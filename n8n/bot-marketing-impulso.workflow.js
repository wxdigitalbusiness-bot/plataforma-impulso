// [BOT] Marketing Impulso - WhatsApp v4.8 (PRODUCAO)
//
// v4.8 difere de v4.7:
//   - Debounce 10s: aguarda silencio do cliente antes de responder.
//     Se chegar nova msg na janela, descarta a resposta anterior.
//     Implementacao: UPSERT retorna my_msg_em_epoch; apos Wait 10s,
//     query Verificar Ultima Msg compara epoch atual contra o gravado;
//     IF Ainda sou a ultima? descarta o flow se vier msg mais nova.
//   - Prompt: novos cenarios K (disse NAO -> pergunta motivo da objecao),
//     L (nichos nao atendidos: Astrologia, religiosos, opcoes binarias,
//     jogos de azar, black, sexy shop), M (como acompanhar resultados ->
//     relatorio).

import {
  workflow, node, trigger, ifElse, splitInBatches, nextBatch,
  languageModel, memory, newCredential, expr
} from '@n8n/workflow-sdk';

const DEFAULT_SYS =
  'Voce e uma das pessoas do time de atendimento da Marketing Impulso. Atende pelo WhatsApp.\n\n' +
  'TOM: msgs CURTAS em 2-3 baloes. PT-BR natural. 1 emoji max por msg. *negrito*. Listas 1 2.\n\n' +
  'SEGURANCA: nunca pede senha/login/CPF/CNPJ/cartao. Se receber credencial: "Pra sua seguranca, *nao preciso e nao devo receber sua senha por aqui*. Vou te passar pro nosso time de configuracao\\n\\n[HANDOFF:credenciais]"\n\n' +
  'CENARIOS:\n' +
  'A) Lead novo: "Ola, boa tarde! Tudo bem?\\n\\nQue bom que veio falar com a gente sobre a Panfletagem Digital.\\n\\nAntes da gente seguir, qual seu nome e o que voce trabalha?"\n\n' +
  'B) Nome+ramo: "Prazer X!\\n\\nHoje voces fazem algum tipo de divulgacao online?"\n\n' +
  'C) Pediu pitch/valor: bridge + pitch numerado 1-6 + "Ficou alguma duvida?". Pitch: "A ideia da Panfletagem Digital e simples: a gente coloca sua oferta pra aparecer no Instagram pra milhares de pessoas proximas, todos os dias.\\n\\nComo funciona:\\n1) *Voce nos informa o que quer divulgar*\\nPromocao, produto, servico.\\n2) *Voce envia os criativos*\\nImagem, video, card. Ate 03/semana.\\n3) *Nos definimos a regiao de alcance*\\nSua cidade e regiao.\\n4) *Sua divulgacao comeca a rodar no Instagram/Facebook*\\nTodo dia, direto no celular.\\n5) *As pessoas interessadas clicam e chegam ate voce*\\nWhatsApp, Instagram ou outro canal.\\n6) *Voce acompanha os resultados*\\nAlcance, visualizacoes e cliques."\n\n' +
  'D) Preco: "Nosso servico de Panfletagem Digital e *R$ 600,00 por mes* - o que da *R$ 20,00 por dia*.\\n\\nE o valor do *trafego pro impulsionamento ja esta incluso*.\\n\\nPagamento antecipado, renovacao mensal opcional"\n\n' +
  'E) Objecao preco: "Entendo\\n\\nO que estaria dentro do seu orcamento? So pra eu entender o que da pra fazer pra pelo menos iniciarmos."\n\n' +
  'F) SIM/contratar: "Que otimo, vamos comecar entao!\\n\\nSo pra confirmar: e o plano *Panfletagem Digital - R$ 600/mes, com trafego incluso*, ta?\\n\\nVou chamar o pessoal aqui pra te passar a forma de pagamento, so um instante\\n\\n[HANDOFF:fechamento_pagamento]"\n\n' +
  'G) Pediu humano: "Vou chamar alguem do time aqui pra te atender melhor, so um instante\\n\\n[HANDOFF:pedido_explicito]"\n\n' +
  'H) Reclamou: "Te entendo. Vou chamar alguem do time pra resolver isso com voce direto, so um instante\\n\\n[HANDOFF:reclamacao]"\n\n' +
  'I) Fora escopo (Trafego Pago, Impulso 360, juridico, financeiro): "Pra essa pergunta vou chamar alguem do time, so um instante\\n\\n[HANDOFF:fora_do_escopo]"\n\n' +
  'J) Imagem/video/doc: "Consegue me mandar por texto ou audio? Aqui so consigo entender essas duas formas"\n\n' +
  'K) Disse NAO/nao quer mais/objecao final/declinou apos pitch ou preco: "Tudo bem\\n\\nSo me ajuda a entender uma coisa: o que mais pesou pra voce nao querer iniciar agora? Sua resposta ajuda demais a gente a melhorar."\n\n' +
  'L) Nicho que NAO atendemos (Astrologia, servicos religiosos, opcoes binarias, jogos de azar, nicho black, sexy shop): "Olha, esse tipo de servico a gente infelizmente nao trabalha\\n\\nMas se voce conhecer alguem com outro tipo de negocio que precise de divulgacao, pode indicar pra gente?"\n\n' +
  'M) Pergunta como acompanhar os resultados: "Voce acompanha por um *relatorio* que a gente envia com os resultados - alcance, visualizacoes e cliques\\n\\nQuer comecar?"\n\n' +
  'REGRA DE OURO - SEMPRE PUXE A PROXIMA ACAO: toda resposta sua DEVE terminar com uma pergunta ou convite que leve o lead ao proximo passo. NUNCA encerre sem um gancho - a conversa nunca pode morrer do seu lado. UNICA EXCECAO: quando aciona [HANDOFF:...], quem continua e o humano, entao NAO puxe proxima acao.\n\n' +
  'INTERNO (NAO COMENTAR): audio e transcrito automaticamente, trate como texto. Marcador [HANDOFF:motivo] e removido antes de chegar ao cliente. Motivos: fechamento_pagamento, credenciais, pedido_explicito, reclamacao, fora_do_escopo.\n\n' +
  'FORMATO: apenas texto puro. Varias msgs com LINHA EM BRANCO entre elas. Sem JSON, sem blocos de codigo. Sem dizer "vou te transferir".';

const pgCredential = newCredential('Postgres EasyPanel');
const anthropicCredential = newCredential('Anthropic');
const evolutionCredential = newCredential('Evolution API');

const webhookTrigger = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: { name: 'Webhook Evolution Impulso', parameters: { httpMethod: 'POST', path: 'wa-impulso-in', options: {} }, position: [0, 192] },
  output: [{ body: { event: 'messages.upsert', instance: 'IMPULSO', data: { key: { remoteJid: '5511900000000@s.whatsapp.net', fromMe: false }, message: { conversation: 'oi' } } } }]
});

const normalizarMensagem = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Normalizar Mensagem',
    parameters: { mode: 'runOnceForEachItem', language: 'javaScript', jsCode: "const b=$input.item.json.body||$input.item.json;const da=b.data||{},k=da.key||{};if(b.event!=='messages.upsert'||!k.remoteJid)return{json:{skip:true}};const p=k.remoteJid.replace('@s.whatsapp.net','');const m=da.message||{};const t=m.conversation||null;return{json:{phone:p,remoteJid:k.remoteJid,pushName:da.pushName||null,body:t,msgType:t?'text':'other',humanoAssumiu:false,skip:false}};" },
    position: [224, 192]
  },
  output: [{ phone: '5511900000000', body: 'oi', msgType: 'text', humanoAssumiu: false, skip: false }]
});

const humanoAssumiu = ifElse({
  version: 2.3,
  config: {
    name: 'Humano assumiu?',
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 }, conditions: [{ id: 'ha1', leftValue: expr('{{ $json.humanoAssumiu }}'), rightValue: true, operator: { type: 'boolean', operation: 'equals' } }], combinator: 'and' }, options: {} },
    position: [448, 192]
  }
});

const marcarHumanoAssumiu = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Marcar Humano Assumiu',
    parameters: { operation: 'executeQuery', query: "INSERT INTO conversas_handoff (phone, handoff_active, motivo) VALUES ($1, TRUE, 'humano_assumiu') ON CONFLICT (phone) DO UPDATE SET handoff_active = TRUE, motivo = 'humano_assumiu', updated_at = NOW();", options: { queryReplacement: expr('{{ $json.phone }}') } },
    credentials: { postgres: pgCredential },
    position: [672, 0]
  },
  output: [{ success: true }]
});

const textoValido = ifElse({
  version: 2.3,
  config: {
    name: 'E texto valido?',
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 }, conditions: [{ id: 'c1', leftValue: expr('{{ $json.skip }}'), rightValue: false, operator: { type: 'boolean', operation: 'equals' } }, { id: 'c2', leftValue: expr('{{ $json.msgType }}'), rightValue: 'text', operator: { type: 'string', operation: 'equals' } }, { id: 'c3', leftValue: expr('{{ $json.body }}'), rightValue: '', operator: { type: 'string', operation: 'notEmpty' } }], combinator: 'and' }, options: { ignoreCase: true } },
    position: [672, 192]
  }
});

const conversaEmHandoff = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Conversa em handoff?',
    parameters: { operation: 'executeQuery', query: 'SELECT COALESCE((SELECT handoff_active FROM conversas_handoff WHERE phone = $1), FALSE) AS handoff_active;', options: { queryReplacement: expr('{{ $json.phone }}') } },
    credentials: { postgres: pgCredential },
    position: [896, 192]
  },
  output: [{ handoff_active: false }]
});

const handoffAtivo = ifElse({
  version: 2.3,
  config: {
    name: 'Handoff ativo?',
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 }, conditions: [{ id: 'h1', leftValue: expr('{{ $json.handoff_active }}'), rightValue: true, operator: { type: 'boolean', operation: 'equals' } }], combinator: 'and' }, options: {} },
    position: [1120, 192]
  }
});

const upsertConversa = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'UPSERT Conversa + Lookup Experimento',
    parameters: { operation: 'executeQuery', query: "WITH up AS (INSERT INTO bot_conversas (phone, push_name) VALUES ($1, $2) ON CONFLICT (phone) DO UPDATE SET ultima_msg_em = NOW(), push_name = COALESCE(EXCLUDED.push_name, bot_conversas.push_name) RETURNING phone, ab_variante, experimento_id, ultima_msg_em) SELECT up.phone, up.ab_variante, up.experimento_id, extract(epoch from up.ultima_msg_em) AS my_msg_em_epoch, (SELECT id FROM bot_experimentos_ab WHERE status='rodando' AND modo_alvo='unico' LIMIT 1) AS exp_id_ativo, (SELECT variante_a FROM bot_experimentos_ab WHERE status='rodando' AND modo_alvo='unico' LIMIT 1) AS prompt_a, (SELECT variante_b FROM bot_experimentos_ab WHERE status='rodando' AND modo_alvo='unico' LIMIT 1) AS prompt_b, (abs(hashtext($1)) % 2) AS hash_variante FROM up;", options: { queryReplacement: expr("{{ $('Normalizar Mensagem').item.json.phone }},{{ $('Normalizar Mensagem').item.json.pushName || 'sem_nome' }}") } },
    credentials: { postgres: pgCredential },
    position: [1344, 192]
  },
  output: [{ phone: '5511900000000', ab_variante: null, experimento_id: null, my_msg_em_epoch: 1780500000.123, exp_id_ativo: null, prompt_a: null, prompt_b: null, hash_variante: 0 }]
});

const esperarDebounce = node({
  type: 'n8n-nodes-base.wait',
  version: 1.1,
  config: { name: 'Esperar Debounce 10s', parameters: { resume: 'timeInterval', amount: 10, unit: 'seconds' }, position: [1568, 192] },
  output: [{ phone: '5511900000000', my_msg_em_epoch: 1780500000.123 }]
});

const verificarUltimaMsg = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Verificar Ultima Msg',
    parameters: { operation: 'executeQuery', query: 'SELECT (extract(epoch from ultima_msg_em) <= $2::numeric) AS sou_ultima FROM bot_conversas WHERE phone = $1;', options: { queryReplacement: expr("{{ $('Normalizar Mensagem').item.json.phone }},{{ $('UPSERT Conversa + Lookup Experimento').item.json.my_msg_em_epoch }}") } },
    credentials: { postgres: pgCredential },
    position: [1792, 192]
  },
  output: [{ sou_ultima: true }]
});

const aindaSouAUltima = ifElse({
  version: 2.3,
  config: {
    name: 'Ainda sou a ultima?',
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 }, conditions: [{ id: 'su1', leftValue: expr('{{ $json.sou_ultima }}'), rightValue: true, operator: { type: 'boolean', operation: 'equals' } }], combinator: 'and' }, options: {} },
    position: [2016, 192]
  }
});

const DECIDIR_CODE =
  "const DEFAULT_SYS = " + JSON.stringify(DEFAULT_SYS) + ";\n" +
  "const r = $('UPSERT Conversa + Lookup Experimento').first().json;\n" +
  "let variante = null, expId = null, systemMessage = DEFAULT_SYS;\n" +
  "if (r.exp_id_ativo) { expId = r.exp_id_ativo; variante = r.ab_variante || (Number(r.hash_variante) === 0 ? 'A' : 'B'); const promptA = r.prompt_a || DEFAULT_SYS; const promptB = r.prompt_b || DEFAULT_SYS; systemMessage = variante === 'A' ? promptA : promptB; }\n" +
  "return [{ json: { phone: r.phone, ab_variante: variante || 'X', experimento_id: expId || -1, system_message: systemMessage, precisa_atribuir: !!variante && !r.ab_variante } }];";

const decidirVariante = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Decidir Variante + System Message', parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: DECIDIR_CODE }, position: [2240, 192] },
  output: [{ phone: '5511900000000', ab_variante: 'X', experimento_id: -1, system_message: 'sys', precisa_atribuir: false }]
});

const registrarVariante = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Registrar Variante (idempotente)',
    parameters: { operation: 'executeQuery', query: "UPDATE bot_conversas SET ab_variante = NULLIF($2, 'X')::char(1), experimento_id = NULLIF($3::int, -1) WHERE phone = $1 AND ab_variante IS NULL;", options: { queryReplacement: expr('{{ $json.phone }},{{ $json.ab_variante }},{{ $json.experimento_id }}') } },
    credentials: { postgres: pgCredential },
    position: [2464, 192]
  },
  output: [{ success: true }]
});

const claudeModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatAnthropic',
  version: 1.5,
  config: { name: 'Claude Sonnet 4.6', parameters: { model: { __rl: true, mode: 'list', value: 'claude-sonnet-4-6', cachedResultName: 'Claude Sonnet 4.6' }, options: { temperature: 0.6, maxTokensToSample: 1500 } }, credentials: { anthropicApi: anthropicCredential }, position: [2704, 416] }
});

const historicoMemory = memory({
  type: '@n8n/n8n-nodes-langchain.memoryPostgresChat',
  version: 1.4,
  config: { name: 'Historico (Postgres)', parameters: { sessionIdType: 'customKey', sessionKey: expr("{{ $('Normalizar Mensagem').item.json.phone }}"), tableName: 'chat_history_marketing_impulso', contextWindowLength: 20 }, credentials: { postgres: pgCredential }, position: [2832, 416] }
});

const atendente = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: { name: 'Atendente Marketing Impulso', parameters: { promptType: 'define', text: expr("{{ $('Normalizar Mensagem').item.json.body }}"), options: { systemMessage: expr("{{ $('Decidir Variante + System Message').item.json.system_message }}"), maxIterations: 3 } }, subnodes: { model: claudeModel, memory: historicoMemory }, position: [2688, 192] },
  output: [{ output: 'resposta' }]
});

const processarResposta = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Processar Resposta',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "const n=$('Normalizar Mensagem').first().json;const rJ=n.remoteJid,ph=n.phone,pn=n.pushName||ph;const r=(items[0]&&items[0].json&&items[0].json.output||'').trim();if(!r)return[{json:{skip:true,remoteJid:rJ,phone:ph}}];let c=r,hm=null;const mv=['fechamento_pagamento','credenciais','pedido_explicito','reclamacao','fora_do_escopo'];const mm=r.match(/\\[HANDOFF:([a-z_]+)\\]/i);if(mm){const mo=mm[1].toLowerCase();if(mv.includes(mo))hm=mo;c=r.replace(/\\[HANDOFF:[a-z_]+\\]/gi,'').trim();}const ms=c.split(/\\n{2,}/).map(p=>p.trim()).filter(p=>p.length>0);return[{json:{remoteJid:rJ,phone:ph,pushName:pn,messages:ms,hasHandoff:!!hm,handoffMotivo:hm,resumo:hm?'Lead '+pn+' ('+ph+')':null,skip:false}}];" },
    position: [3040, 192]
  },
  output: [{ remoteJid: 'x', phone: 'y', messages: [], hasHandoff: false, handoffMotivo: null, resumo: null, skip: false }]
});

const temHandoff = ifElse({
  version: 2.3,
  config: { name: 'Tem handoff?', parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 }, conditions: [{ id: 'th1', leftValue: expr('{{ $json.hasHandoff }}'), rightValue: true, operator: { type: 'boolean', operation: 'equals' } }], combinator: 'and' }, options: {} }, position: [3264, 192] }
});

const marcarHandoffResultado = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: { name: 'Marcar Handoff + Resultado', parameters: { operation: 'executeQuery', query: "INSERT INTO conversas_handoff (phone, handoff_active, motivo) VALUES ($1, TRUE, $2) ON CONFLICT (phone) DO UPDATE SET handoff_active = TRUE, motivo = EXCLUDED.motivo, updated_at = NOW(); UPDATE bot_conversas SET resultado = CASE WHEN $2 = 'fechamento_pagamento' THEN 'pendente_confirmacao' ELSE resultado END WHERE phone = $1;", options: { queryReplacement: expr('{{ $json.phone }},{{ $json.handoffMotivo }}') } }, credentials: { postgres: pgCredential }, position: [3488, 128] },
  output: [{ success: true }]
});

const notificarTime = node({
  type: 'n8n-nodes-evolution-api.evolutionApi',
  version: 1,
  config: { name: 'Notificar Time (Grupo)', parameters: { resource: 'messages-api', operation: 'send-text', instanceName: 'IMPULSO', remoteJid: '120363404188796908@g.us', messageText: expr("Handoff humano\n{{ $('Processar Resposta').item.json.resumo }}"), options_message: {} }, credentials: { evolutionApi: evolutionCredential }, position: [3712, 128] },
  output: [{ success: true }]
});

const quebrarEmItens = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Quebrar em Itens', parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "const out=[];const p=$('Processar Resposta').first().json;if(p.skip)return[];const rJ=p.remoteJid,ms=p.messages||[];for(let i=0;i<ms.length;i++){const t=ms[i];const ws=Math.max(1.5,Math.min(5,t.length*0.04));out.push({json:{text:t,remoteJid:rJ,waitSeconds:ws,isLast:i===ms.length-1}});}return out;" }, position: [3936, 192] },
  output: [{ text: 'x', remoteJid: 'y', waitSeconds: 2, isLast: false }]
});

const loopPorMensagem = splitInBatches({
  version: 3,
  config: { name: 'Loop por mensagem', parameters: { options: {} }, position: [4160, 192] }
});

const digitandoPresence = node({
  type: 'n8n-nodes-evolution-api.evolutionApi',
  version: 1,
  config: { name: 'Digitando (Presence)', parameters: { resource: 'chat-api', operation: 'send-presence', instanceName: 'IMPULSO', remoteJid: expr('{{ $json.remoteJid }}'), presence: 'composing', delay: 1200 }, credentials: { evolutionApi: evolutionCredential }, position: [4384, 128] },
  output: [{ success: true }]
});

const esperarDigitando = node({
  type: 'n8n-nodes-base.wait',
  version: 1.1,
  config: { name: 'Esperar digitando', parameters: { resume: 'timeInterval', amount: expr("{{ $('Loop por mensagem').item.json.waitSeconds }}"), unit: 'seconds' }, position: [4608, 128] },
  output: [{ success: true }]
});

const enviarTexto = node({
  type: 'n8n-nodes-evolution-api.evolutionApi',
  version: 1,
  config: { name: 'Enviar Texto (Evolution)', parameters: { resource: 'messages-api', operation: 'send-text', instanceName: 'IMPULSO', remoteJid: expr("{{ $('Loop por mensagem').item.json.remoteJid }}"), messageText: expr("{{ $('Loop por mensagem').item.json.text }}"), options_message: {} }, credentials: { evolutionApi: evolutionCredential }, position: [4832, 192] },
  output: [{ success: true }]
});

const loopComBatch = loopPorMensagem
  .onEachBatch(digitandoPresence.to(esperarDigitando).to(enviarTexto).to(nextBatch(loopPorMensagem)));

export default workflow('2Vjne0U1dXtdfvMZ', '[BOT] Marketing Impulso - WhatsApp v4 (PRODUCAO)')
  .add(webhookTrigger)
  .to(normalizarMensagem)
  .to(humanoAssumiu
    .onTrue(marcarHumanoAssumiu)
    .onFalse(textoValido
      .onTrue(conversaEmHandoff
        .to(handoffAtivo
          .onFalse(upsertConversa
            .to(esperarDebounce)
            .to(verificarUltimaMsg)
            .to(aindaSouAUltima
              .onTrue(decidirVariante
                .to(registrarVariante)
                .to(atendente)
                .to(processarResposta)
                .to(temHandoff
                  .onTrue(marcarHandoffResultado
                    .to(notificarTime)
                    .to(quebrarEmItens)
                    .to(loopComBatch)
                  )
                  .onFalse(quebrarEmItens
                    .to(loopComBatch)
                  )
                )
              )
            )
          )
        )
      )
    )
  );
