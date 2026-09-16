# Agentes de noticias

Camada de agentes de IA (buscador + resumidor) do sistema de noticias para apoio
a decisao. Le e escreve exclusivamente no Postgres compartilhado com a interface
Next.js — nenhum HTTP endpoint e exposto por este servico.

## Setup

```
cd agentes
cp .env.example .env   # preencher DATABASE_URL e HF_TOKEN
uv sync
uv run playwright install chromium
uv run main.py
```

Roda localmente sem GPU dedicada: usa Apple Metal (MPS) quando disponivel (ex:
MacBook Air M4) ou CPU como fallback, com os modelos em fp16/fp32 (sem
bitsandbytes/CUDA). Defaults leves o suficiente para caberem juntos em 16GB de
RAM unificada: Qwen2.5-1.5B-Instruct (selecao) e Qwen2.5-3B-Instruct (resumo).
