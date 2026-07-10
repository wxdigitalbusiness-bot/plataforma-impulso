// node migrate-tarefas.cjs  (rodar da pasta raiz do projeto)
const { PrismaClient } = require("./web/node_modules/@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS crm_projetos (
      id          SERIAL       PRIMARY KEY,
      cliente_id  INTEGER      NOT NULL,
      nome        TEXT         NOT NULL,
      descricao   TEXT,
      cor         TEXT         NOT NULL DEFAULT '#6366f1',
      status      TEXT         NOT NULL DEFAULT 'ativo',
      criado_em   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS crm_tarefas (
      id             SERIAL       PRIMARY KEY,
      projeto_id     INTEGER      NOT NULL REFERENCES crm_projetos(id) ON DELETE CASCADE,
      cliente_id     INTEGER      NOT NULL,
      titulo         TEXT         NOT NULL,
      descricao      TEXT,
      status         TEXT         NOT NULL DEFAULT 'a_fazer',
      prioridade     TEXT         NOT NULL DEFAULT 'media',
      data_limite    DATE,
      responsavel    TEXT,
      lead_id        TEXT,
      visivel_portal BOOLEAN      NOT NULL DEFAULT false,
      posicao        INTEGER      NOT NULL DEFAULT 0,
      criado_em      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      atualizado_em  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS crm_microtarefas (
      id          SERIAL       PRIMARY KEY,
      tarefa_id   INTEGER      NOT NULL REFERENCES crm_tarefas(id) ON DELETE CASCADE,
      texto       TEXT         NOT NULL,
      concluida   BOOLEAN      NOT NULL DEFAULT false,
      ordem       INTEGER      NOT NULL DEFAULT 0,
      criado_em   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);

  console.log("✓ crm_projetos, crm_tarefas, crm_microtarefas criadas (ou já existiam)");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
