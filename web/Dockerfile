# syntax=docker/dockerfile:1.7
# Plataforma Impulso — Next.js production image
# Build context deve ser o diretório `web/`
#
# Multi-stage:
#   1. deps    → instala node_modules + gera Prisma client
#   2. builder → roda `next build` produzindo .next/standalone
#   3. runner  → imagem final mínima (≈150MB) rodando server.js

# ───────────────────────── Stage 1: deps ─────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# openssl é exigido pelo Prisma query engine no Alpine
RUN apk add --no-cache libc6-compat openssl

COPY package.json package-lock.json* ./
COPY prisma ./prisma

# `npm ci` é determinístico e ignora o `postinstall: prisma generate` quando
# falta o schema. Forçamos generate depois explicitamente.
RUN npm ci --include=dev
RUN npx prisma generate

# ────────────────────────── Stage 2: build ───────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl git

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
COPY . .

# Next.js coleta env vars NEXT_PUBLIC_* no build. Mas as secrets do servidor
# (DATABASE_URL, AUTH_SECRET, GOOGLE_ADS_*, META_*) só são lidas em runtime.
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Número do PR/merge para exibir na sidebar. Passe via: --build-arg BUILD_LABEL=<n>
# Se não fornecido, tenta ler o SHA do git (disponível se .git estiver no contexto)
ARG BUILD_LABEL
RUN if [ -n "$BUILD_LABEL" ]; then \
      echo "$BUILD_LABEL"; \
    elif [ -d ".git" ]; then \
      git log -1 --format='#%h'; \
    else \
      echo "dev"; \
    fi > /tmp/build-label

RUN npm run build

# ────────────────────────── Stage 3: runner ──────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache openssl

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Usuário não-root pra segurança
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Copia o output standalone (já contém só os deps necessários)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Prisma client + engines precisam ir junto (não estão no standalone output)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# Label de build para exibir na sidebar
COPY --from=builder --chown=nextjs:nodejs /tmp/build-label ./.build-label

USER nextjs

EXPOSE 3000

# server.js é gerado pelo `output: "standalone"`
CMD ["node", "server.js"]
