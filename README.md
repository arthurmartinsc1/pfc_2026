# Sistema de Notícias para Apoio à Decisão (PFC 2026)

Busca notícias a partir de assuntos cadastrados, resume cada uma com um LLM e
exibe tudo num painel web.

| Pasta | O que é |
|---|---|
| [`web/`](web/) | Interface web (Next.js + Prisma) e o banco PostgreSQL (Docker) |
| [`agentes/`](agentes/) | Agentes de IA em Python: buscador + resumidor, em loop de polling |

As duas partes se comunicam **somente pelo banco de dados**. Os modelos de
linguagem rodam fora deste repositório, numa VM com GPU (vLLM), acessada pela VPN.

**Instalação, configuração e operação: [`MANUAL.md`](MANUAL.md).**

Início rápido (detalhes no manual):

```bash
cd web && cp env.example .env && docker compose up -d
npm install && npx prisma migrate deploy && npm run dev        # http://localhost:3000

cd ../agentes && cp .env.example .env                          # preencher URLs dos LLMs e a chave
uv sync && uv run playwright install chromium && uv run main.py
```
