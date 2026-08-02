# Sistema de Notícias — Interface Web

Interface web (Next.js) de um sistema de apoio à decisão. Ela lista notícias
coletadas a partir de palavras-chave configuráveis, mostra o status das
buscas e permite gerenciar as palavras-chave e configurações gerais.

O sistema completo tem dois componentes que **nunca se comunicam
diretamente**, apenas através do banco de dados PostgreSQL:

- **Esta interface** — lê e exibe notícias, gerencia `keywords` e
  `app_settings`.
- **Agentes de IA** (busca + resumo de notícias, fora deste repositório) —
  escrevem `search_jobs` e `news_items`.

Por isso a aplicação funciona normalmente mesmo sem os agentes rodando —
basta o banco existir. Veja [`docs/CONTRATO.md`](docs/CONTRATO.md) para o
contrato completo de schema e responsabilidades, e
[`docs/PLANO.md`](docs/PLANO.md) para o plano de implementação por fases.

## Stack

- Next.js (App Router) + TypeScript
- Prisma ORM
- PostgreSQL via Docker
- Tailwind CSS

## Pré-requisitos

- Node.js 20+ e npm
- Docker Desktop (para o PostgreSQL)

## Configuração inicial

1. **Variáveis de ambiente**

   ```bash
   cp env.example .env
   ```

   Por padrão o Postgres do `docker-compose.yml` é exposto na porta
   `5434` do host (não `5432`) para evitar conflito com instalações locais
   de Postgres ou outros containers. Se a `5434` também estiver ocupada na
   sua máquina, ajuste a porta em **ambos** `docker-compose.yml` e `.env`.

2. **Subir o banco de dados**

   ```bash
   docker compose up -d
   ```

3. **Instalar dependências**

   ```bash
   npm install
   ```

   (o `postinstall` já roda `prisma generate` automaticamente)

4. **Aplicar as migrations**

   ```bash
   npx prisma migrate deploy
   ```

5. **(Opcional) Popular com dados fictícios**

   Útil para desenvolvimento enquanto os agentes ainda não escreveram nada
   no banco:

   ```bash
   npx prisma db seed
   ```

6. **Rodar a aplicação**

   ```bash
   npm run dev
   ```

   Acesse [http://localhost:3000](http://localhost:3000).

## Scripts disponíveis

| Comando | Descrição |
|---|---|
| `npm run dev` | Sobe a aplicação em modo desenvolvimento |
| `npm run build` | Build de produção |
| `npm run start` | Roda o build de produção |
| `npm run lint` | Roda o ESLint |
| `npx prisma migrate dev` | Cria e aplica uma nova migration (dev) |
| `npx prisma migrate deploy` | Aplica migrations existentes (produção) |
| `npx prisma db seed` | Popula o banco com dados fictícios |
| `npx prisma studio` | Interface visual para inspecionar o banco |

## Estrutura do projeto

```
src/
  app/                  # Rotas (App Router)
    page.tsx            # Feed de notícias
    configuracoes/      # CRUD de keywords + configurações gerais
    error.tsx            # Erro amigável para falhas de carregamento
    not-found.tsx         # Página 404
  components/           # Componentes de UI
  lib/
    prisma.ts           # Client Prisma (singleton)
    queries.ts           # Leituras do banco
    actions.ts            # Server actions (escritas do banco)
prisma/
  schema.prisma          # Schema (conforme docs/CONTRATO.md + app_settings)
  migrations/            # Histórico de migrations
  seed.ts                 # Dados fictícios para desenvolvimento
```

## Regras importantes

- A interface nunca chama os agentes diretamente nem expõe endpoints para
  eles — toda comunicação é via estado no banco.
- A interface não escreve em `news_items.resumo`, `search_jobs.status` nem
  nos demais campos de propriedade do agente (ver tabela de
  responsabilidades em `docs/CONTRATO.md`).
- O campo `descartada` em `news_items` e a tabela `app_settings` são
  extensões da interface, fora do contrato com o agente.
