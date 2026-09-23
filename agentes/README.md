# Agentes de noticias

Camada de agentes de IA (buscador + resumidor) do sistema de noticias para apoio
a decisao. Le e escreve exclusivamente no Postgres compartilhado com a interface
Next.js — nenhum HTTP endpoint e exposto por este servico.

## Setup

```
cd agentes
cp .env.example .env   # preencher DATABASE_URL e as variaveis LLM_*
uv sync
uv run playwright install chromium
uv run main.py
```

Este processo roda localmente (junto com o Postgres/pfc_web) e nao carrega
nenhum peso de modelo — a geracao (selecao de artigos e resumo) e feita por
chamadas HTTP a LLMs servidos via vLLM (API compativel com OpenAI) numa VM com
GPU, acessada pela VPN. Configure `BUSCADOR_LLM_BASE_URL`/`RESUMIDOR_LLM_BASE_URL`
com o IP da VM na VPN e a porta de cada modelo (ver `.env.example`).
