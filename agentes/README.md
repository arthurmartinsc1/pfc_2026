# Agentes de notícias

Camada de agentes de IA (buscador + resumidor) do sistema. Lê e escreve
exclusivamente no Postgres compartilhado com a interface (`../web`); não expõe
nenhum endpoint HTTP. A geração de texto é feita por chamadas HTTP a LLMs
servidos via vLLM numa VM com GPU, acessada pela VPN.

```bash
cp .env.example .env    # preencher DATABASE_URL, *_LLM_BASE_URL e LLM_API_KEY
uv sync
uv run playwright install chromium
uv run main.py
```

Todas as variáveis, o funcionamento do pipeline e a solução de problemas estão
no [`MANUAL.md`](../MANUAL.md) da raiz (seções 6, 7, 8 e 12).
