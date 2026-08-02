# Plano de Implementação em Fases

Cada fase deve ser concluída, validada (build/lint rodando, aplicação de pé) e aprovada antes de seguir para a próxima. Não pule fases.

## Fase 0 — Setup do projeto
- Criar projeto Next.js (App Router, TypeScript, Tailwind) na raiz.
- Configurar Prisma apontando para `DATABASE_URL` do `.env`.
- Confirmar que `docker compose up -d` sobe o Postgres e a aplicação conecta.
- Nenhuma tela ainda — só o esqueleto rodando.

## Fase 1 — Schema e dados mockados
- Criar o schema Prisma conforme `docs/CONTRATO.md`.
- Rodar a primeira migration.
- Criar script de seed com dados fictícios (keywords, jobs concluídos e com erro, notícias com múltiplas keywords associadas via `news_keyword_matches`).
- Validar via Prisma Studio ou query simples que os dados mockados estão coerentes.

## Fase 2 — Página inicial (feed de notícias)
- Listagem de notícias com filtros (keyword, data) e paginação.
- Indicador de saúde do sistema (última execução concluída).
- Ação de "descartar" notícia.
- Estado vazio tratado (sem notícias, sem jobs).

## Fase 3 — Página de configurações
- CRUD de keywords.
- Exibição do status/última execução por keyword.
- Configurações gerais via `app_settings`.

## Fase 4 (opcional) — Página de execuções/auditoria
- Histórico de `search_jobs` com status, origem e erro.

## Fase 5 — Polimento
- Revisão de UX, responsividade, mensagens de erro amigáveis.
- README final com instruções de setup.
