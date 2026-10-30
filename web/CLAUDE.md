# Contexto do Projeto — Sistema de Notícias (Interface Web)

Este projeto é a **interface web** de um sistema de apoio à decisão (TCC/PFC). O sistema completo tem dois componentes: agentes de IA (busca e resumo de notícias — pasta `agentes/` na raiz deste monorepo) e esta interface (Next.js).

**Leia `docs/CONTRATO.md` antes de qualquer alteração de schema ou lógica de dados.** Esse documento é o contrato acordado com a outra pessoa do time e não deve ser alterado sem necessidade explícita — mudanças no schema quebram o trabalho dela.

## Stack obrigatória
- Next.js (App Router) + TypeScript
- Prisma ORM
- PostgreSQL via Docker (docker-compose.yml na raiz)
- Tailwind CSS
- Sem dependências de serviços externos em nuvem (autenticação, se houver, deve ser local)

## Regras inegociáveis
- A interface se comunica com os agentes **exclusivamente via banco de dados**. Nunca criar endpoint para o agente chamar, nem chamar API externa de busca/LLM a partir do Next.js.
- Respeitar a tabela de propriedade de escrita definida em `docs/CONTRATO.md` (ex: a interface nunca escreve em `news_items.resumo` ou `search_jobs.status`).
- A aplicação deve funcionar normalmente mesmo sem nenhum job concluído no banco (estados vazios tratados).

## Como trabalhar comigo (Claude Code) neste projeto
- Vamos trabalhar em fases pequenas. Não avance para a próxima fase sem eu confirmar que a atual está ok.
- Ao final de cada fase, rode lint/build e garanta que a aplicação sobe sem erro antes de parar.
- Sempre comente no chat quais arquivos foram criados/alterados e por quê, de forma resumida.
