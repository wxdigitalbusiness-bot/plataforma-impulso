# Plataforma Impulso — Web (Fase 2)

Painel interno da Agência Impulso. Conecta ao mesmo Postgres do n8n. Mostra saldo Meta Ads em tempo real e permite gerenciar quem recebe alerta de saldo baixo.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS 4
- Prisma 7 (Postgres)
- NextAuth (Auth.js) v5 — credenciais (email/senha bcrypt)

## Como rodar local

```bash
# 1. Configurar variaveis de ambiente
cp .env.local.example .env.local
# editar .env.local com DATABASE_URL, AUTH_SECRET, META_ACCESS_TOKEN

# 2. Gerar Prisma client
npm run db:generate

# 3. Criar primeiro usuario admin
ADMIN_EMAIL=seu@email.com ADMIN_SENHA=sua_senha_forte ADMIN_NOME="Seu Nome" npm run seed:admin

# 4. Subir dev server
npm run dev
# acessa http://localhost:3000
```

## Variaveis de ambiente necessarias

| Variavel | Descricao |
| --- | --- |
| `DATABASE_URL` | Postgres EasyPanel (mesma do n8n) |
| `AUTH_SECRET` | Gerar com `openssl rand -base64 32` |
| `AUTH_URL` | URL base (ex: http://localhost:3000) |
| `META_ACCESS_TOKEN` | System User token Meta para consulta de saldo no dashboard |

## Estrutura

```
src/
  app/
    (app)/              # rotas protegidas
      layout.tsx        # shell com sidebar
      page.tsx          # dashboard (saldos)
      clientes/         # CRUD de clientes
      alertas/          # historico de envios
    login/              # tela publica de login
    api/auth/           # NextAuth route handler
  lib/
    auth.ts             # config NextAuth + signIn/signOut
    db.ts               # PrismaClient singleton
    meta-api.ts         # consulta saldo Meta Graph API
  middleware.ts         # protege rotas via NextAuth
prisma/
  schema.prisma         # mapeia clientes_ativos, alertas_saldo_log, usuarios
scripts/
  seed-admin.ts         # cria/atualiza usuario admin
```

## Tabelas do Postgres usadas

- `clientes_ativos` (criada pela [MIGRACAO 001] do n8n)
- `alertas_saldo_log` (criada pela [MIGRACAO 001] do n8n)
- `usuarios` (criada pela [MIGRACAO 005] do n8n)

## Integracao com o n8n

A plataforma **le e escreve** na mesma base que o workflow `[ALERTA] Saldo Baixo Meta Ads` usa. Ou seja:

- Cadastrar/editar/excluir cliente aqui = afeta o que o workflow alerta
- Toggle "Receber alerta de saldo baixo" = liga/desliga o alerta para esse cliente
- Pagina "Historico de alertas" = mostra os disparos ja feitos pelo n8n

## Proximos passos sugeridos

- [ ] Multi-usuario (cadastrar membros da equipe pela UI)
- [ ] Botao "Testar alerta agora" (chama webhook do n8n)
- [ ] Graficos de gasto Meta Ads por cliente
- [ ] Acesso do cliente final (multi-tenant)
