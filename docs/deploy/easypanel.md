# Deploy — Plataforma Impulso (Next.js)

**Target:** EasyPanel — mesma instância onde Postgres + n8n já rodam.
**Domínio:** https://plataforma.marketingimpulso.com (DNS já apontado).

---

## Pré-requisitos

1. ✅ Repo público ou conectado ao EasyPanel: `wxdigitalbusiness-bot/plataforma-impulso`
2. ✅ DNS `plataforma.marketingimpulso.com` apontando pro IP do VPS
3. ✅ Postgres rodando no EasyPanel (serviço `impulso/postgres`)
4. ✅ n8n rodando (não necessário, mas é onde os workflows orquestram o sync)

---

## Passo 1 — Criar novo serviço (App)

No EasyPanel, dentro do projeto **impulso**:

1. Clicar **+ Serviço** → **App** (não use "From template")
2. Nome: `web` (ou `plataforma-impulso`)
3. **Source:** GitHub
   - Repository: `wxdigitalbusiness-bot/plataforma-impulso`
   - Branch: `main`
   - **Build Path:** `web` (importante — o app fica em subdir)
4. **Build Method:** Dockerfile (detecta automaticamente o `web/Dockerfile`)
5. **Port:** `3000` (o standalone do Next escuta nessa porta)

---

## Passo 2 — Variáveis de Ambiente

Cole no campo "Variáveis de Ambiente" do serviço:

```env
# Postgres (use hostname interno do EasyPanel = mais rápido + seguro)
# Substitua "impulso_postgres" pelo nome real do serviço Postgres no painel
DATABASE_URL=postgresql://postgres:SUA_SENHA@impulso_postgres:5432/impulso?schema=public&sslmode=disable

# NextAuth — gerar AUTH_SECRET com: openssl rand -base64 32
AUTH_SECRET=<<gerar_secret_de_32_bytes>>
AUTH_URL=https://plataforma.marketingimpulso.com

# Meta Graph API
META_ACCESS_TOKEN=<<token_system_user_meta>>

# Google Ads API
GOOGLE_ADS_CLIENT_ID=663591477567-vun0dhbvfq7ioktt6d77k8bn8hl1c96i.apps.googleusercontent.com
GOOGLE_ADS_CLIENT_SECRET=<<client_secret_atual>>
GOOGLE_ADS_REFRESH_TOKEN=<<refresh_token_atual>>
GOOGLE_ADS_DEVELOPER_TOKEN=<<developer_token>>
GOOGLE_ADS_MCC_ID=8259939796

# Padrão Next.js
NODE_ENV=production
```

> Os valores `<<...>>` você pega do `.env.local` que já está funcionando no dev.

**Por que `impulso_postgres` em vez do hostname público?**
O Postgres do EasyPanel expõe um nome de host interno na rede Docker do projeto. Conectar pela rede interna evita latência + saída pra internet pública e dispensa SSL.

---

## Passo 3 — Configurar Domínio + SSL

Aba **Domínios** do serviço:

1. **+ Adicionar Domínio**
2. Host: `plataforma.marketingimpulso.com`
3. Path: `/`
4. Container Port: `3000`
5. **HTTPS:** Sim (EasyPanel emite Let's Encrypt automaticamente)
6. Salvar

Se o DNS está OK (`A` record apontando pro IP do VPS), em ~30s o cert sai.

---

## Passo 4 — Implantar

1. Aba **Implantações** → **Implantar agora**
2. Acompanhar logs do build (3-5 min na 1ª vez)
3. Quando o status do serviço ficar verde ●, abrir https://plataforma.marketingimpulso.com

---

## Pós-deploy

### Criar o primeiro usuário admin

Via terminal local (ou um container shell no EasyPanel), conectado ao DB de produção:

```sh
cd web
DATABASE_URL="postgres://..." npm run seed:admin
```

O script está em `web/scripts/seed-admin.ts`.

### Smoke test

- [ ] `https://plataforma.marketingimpulso.com` → redireciona pra `/login`
- [ ] Login com admin recém-criado funciona
- [ ] Dashboard mostra os cards
- [ ] `/clientes` lista os clientes
- [ ] Botão "Atualizar agora" funciona (chama Meta + Google APIs)

---

## Atualizações futuras

EasyPanel pode estar configurado pra auto-deploy on push (webhook). Se não estiver:

1. `git push origin main`
2. Painel → serviço `web` → **Implantar**

---

## Rollback rápido

Se algo quebrar:
1. EasyPanel → serviço `web` → **Implantações** → escolher versão anterior → **Restaurar**

Ou via git:
```sh
git revert <commit_problemático>
git push origin main
```

---

## Troubleshooting

### Build falha em "prisma generate"
Confira se `prisma/schema.prisma` está sendo copiado no Dockerfile (já está) e se o `postinstall` não está bloqueando (usamos `npm ci --include=dev` que mantém devDeps no estágio de build).

### Erro "Cannot find module .prisma/client"
O `prisma generate` precisa rodar antes do `next build`. No nosso Dockerfile isso já está na ordem certa.

### 502 Bad Gateway
- Container port deve ser **3000** (não 80)
- `HOSTNAME=0.0.0.0` precisa estar setado (já está no Dockerfile)

### Login não persiste sessão
Confira `AUTH_URL=https://plataforma.marketingimpulso.com` (com `https://` exato e sem `/` final).
