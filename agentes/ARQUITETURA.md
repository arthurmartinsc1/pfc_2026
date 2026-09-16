# Arquitetura — Camada de Agentes de IA

Backend de busca e resumo de notícias para apoio à decisão. É uma das **duas camadas
totalmente desacopladas** do sistema:

- **Esta camada (agentes de IA)** — Python, roda localmente, busca e resume notícias.
- **Interface web (Next.js)** — feita por outra pessoa, dona das keywords/assuntos e
  da exibição.

> **Contrato central:** as duas camadas **nunca se chamam diretamente**. Não há HTTP,
> endpoint, webhook nem função compartilhada. Toda comunicação acontece
> **exclusivamente pelo estado gravado no PostgreSQL compartilhado.**

> **Status desta versão:** o modelo em produção ainda é a `keyword` simples (um termo).
> A evolução para **Assunto + termos relacionados** está desenhada e aguardando a
> migration do front — ver **§13**. Onde o comportamento ainda não está no ar, o texto
> marca **(planejado)**.

---

## 1. Visão geral do fluxo

```
Interface (Next.js)                     Agentes de IA (este repo)
─────────────────────                   ─────────────────────────
cria/ativa keywords ───┐
insere job manual ─────┤                ┌── loop de polling (a cada 60s) ──┐
                       ▼                 │  1. recupera jobs travados        │
                 ┌───────────┐           │  2. processa jobs manuais         │
                 │ PostgreSQL │◄─────────┤  3. reagenda keywords (intervalo) │
                 │ compartilh.│          │     - buscador (Google News)      │
                 └───────────┘──────────►│     - seletor LLM (top-K)         │
                       ▲                 │     - resumidor LLM (por artigo)  │
lê jobs (status) ──────┤                 │     - grava news_items + vínculos │
lê news_items ─────────┘                 └───────────────────────────────────┘
exibe no flash card
```

Ninguém "avisa" ninguém: cada lado faz polling/leitura do banco no seu próprio ritmo.
Se os agentes estiverem parados, a interface simplesmente mostra o último estado
conhecido.

---

## 2. Permissões (regra rígida)

| Tabela                  | Agentes | Observação                                      |
|-------------------------|---------|-------------------------------------------------|
| `keywords`              | **só leitura** (`WHERE ativo = true`) | quem cria/ativa/desativa é a interface; inclui `termos_relacionados` (planejado) |
| `search_jobs`           | leitura + escrita | agente é o **único** que transiciona `status` |
| `news_items`            | leitura + escrita | nunca escreve na coluna `descartada` (é da interface) |
| `news_keyword_matches`  | leitura + escrita | tabela associativa N:N |
| `app_settings` / auth   | **nada** | escopo exclusivo da interface |

Ciclo de vida do `status` (só o agente muda): `pendente → rodando → concluido | erro`.

---

## 3. Banco de dados (schema real — Prisma)

Os PKs/FKs são **UUID** (gerados no banco via `gen_random_uuid()`), timestamps são
`timestamp without time zone`, e `status`/`origem` são **enums nativos** do Postgres
(`"JobStatus"`, `"JobOrigin"`). O agente **não roda migrations** — só lê/escreve.

- **keywords**: `id`, `termo` (nome do assunto), `ativo`, `intervalo_minutos`,
  `created_at`, `termos_relacionados text[]` *(planejado — ver §13)*
- **search_jobs**: `id`, `keyword_id`, `status`, `origem`, `started_at`,
  `finished_at`, `erro_msg`, `created_at`
- **news_items**: `id`, `titulo`, `url` (UNIQUE), `fonte`, `resumo`, `relevancia`,
  `data_publicacao_original`, `fetched_at`, `descartada` (da interface)
- **news_keyword_matches**: `id`, `news_item_id`, `keyword_id`, `job_id`, `created_at`

**Por que a tabela associativa:** uma mesma notícia (URL única) pode bater com várias
keywords. A notícia existe **uma vez** em `news_items`; cada "encontro" com uma
keyword é uma linha em `news_keyword_matches`. Notícia nunca é duplicada.

---

## 4. Regras de negócio

1. **Dedup por URL:** antes de inserir, `INSERT ... ON CONFLICT (url) DO NOTHING` +
   `SELECT id`. Se a URL já existe, só cria o vínculo novo (não duplica a notícia).
2. **Ciclo de vida do job:** ao pegar → `rodando` + `started_at`; sucesso →
   `concluido` + `finished_at`; falha → `erro` + `erro_msg`. Nunca fica preso em
   `rodando` (ver reaper, §6).
3. **Jobs manuais têm prioridade** sobre os agendados no polling.
4. **Nunca grava notícia sem resumo** — se o resumidor falha naquele artigo, ele é
   pulado (nunca entra pela metade).
5. **Só o parágrafo do resumo vai pro banco** — `ASSUNTO`/`PRINCIPAIS TEMAS` são
   andaimes do prompt e são removidos antes de gravar (a interface exibe só a prosa).

---

## 5. Módulos (`agentes/`)

| Arquivo            | Responsabilidade |
|--------------------|------------------|
| `main.py`          | entrypoint — configura logging e chama o loop |
| `config.py`        | lê `.env`, defaults e lista de fontes permitidas |
| `db.py`            | engine/session SQLAlchemy; trata `?schema=` do Prisma |
| `models.py`        | mapeia as 4 tabelas (UUID, enums como String); nunca cria tabela |
| `repository.py`    | acesso a dados; aplica as permissões e o dedup |
| `google_news.py`   | resolve URLs do Google News → URL real (cascata de fallbacks) |
| `buscador.py`      | busca no Google News + seleção top-K via LLM |
| `resumidor.py`     | extrai o artigo + gera/normaliza o resumo via LLM |
| `orchestrator.py`  | pipeline por job: buscador → resumidor → persistência |
| `poller.py`        | loop de polling: reaper, jobs manuais, reagendamento por intervalo |
| `local_llm.py`     | seleção de device (MPS/CPU) e dtype |

---

## 6. Loop de polling (`poller.py`)

A cada `POLL_INTERVAL_SECONDS` (padrão 60s), executa em ordem:

1. **Reaper** — jobs presos em `rodando` há mais de `JOB_TIMEOUT_MINUTOS` (padrão 30)
   viram `erro` automaticamente. Cobre o caso de o processo morrer no meio (crash,
   kill) sem conseguir rodar o bloco de tratamento de erro. Evita que o indicador de
   saúde da interface (`MAX(finished_at) WHERE status='concluido'`) trave.
2. **Jobs manuais pendentes** — a interface insere `search_jobs` com `origem='manual'`,
   `status='pendente'`; são processados **com prioridade**.
3. **Keywords ativas por intervalo** — para cada keyword `ativo = true`, verifica se
   **não existe nenhum job dela criado nos últimos `intervalo_minutos`**; se não
   existe, cria um job `origem='agendado'` e processa. Isso cobre num só teste os dois
   casos: **keyword nova** (nenhum job ainda) e **reagendamento periódico** (já passou
   o intervalo desde o último job). Assim cada assunto é revisitado ao longo do tempo,
   buscando notícias novas (a dedup por URL evita repetir as já salvas).

   Detalhes:
   - `intervalo_minutos` é lido do banco **a cada ciclo** → mudanças feitas pela
     interface valem sem reiniciar o agente.
   - **Qualquer origem conta** no intervalo — um job manual recente também "reseta" o
     timer, evitando busca redundante logo após uma manual.
   - A comparação de tempo é feita **no Postgres** (`created_at` vs `now()`), no mesmo
     relógio/fuso do banco — evita bug de timezone (os timestamps do banco são naive).
   - `ativo = false` para de reagendar.

---

## 7. Pipeline de um job (`orchestrator.py`)

1. Marca o job como `rodando`.
2. **Buscador** (`buscador.py`): consulta o Google News (RSS via `gnews`), filtra por
   fontes permitidas, e — se houver mais candidatos que `BUSCADOR_TOP_K` — usa o LLM
   seletor para escolher os top-K mais relevantes para a keyword.
3. Para cada candidato selecionado, **Resumidor** (`resumidor.py`):
   - Extrai o artigo (`requests` + `trafilatura`, com fallback Playwright para sites
     React/Next.js client-side).
   - Gera o resumo com o LLM e normaliza a saída para **apenas o parágrafo**.
4. **Persistência** (`repository.py`): dedup por URL em `news_items`, vínculo em
   `news_keyword_matches`. Falha em um artigo não derruba o job (é logada e pulada).
5. Marca `concluido` (ou `erro` se nada foi processado / houve exceção).

Logs por etapa: keyword processada, nº de candidatos, buscando/gerando/pronto por
artigo (com tempos), e resumo final de novas/duplicadas/falhas.

---

## 8. Modelos de IA (execução local)

Rodam **localmente sem GPU dedicada**: Apple Metal (MPS) quando disponível (ex:
MacBook Air M4) ou CPU, em fp16/fp32 — **sem `bitsandbytes`/CUDA** (a quantização 4-bit
dos notebooks originais não roda em Apple Silicon).

| Papel      | Modelo (default)            | Quando roda |
|------------|-----------------------------|-------------|
| Seletor    | `Qwen/Qwen2.5-1.5B-Instruct`| só quando há mais candidatos que `TOP_K` |
| Resumidor  | `Qwen/Qwen2.5-3B-Instruct`  | uma vez por artigo selecionado |

Carregamento é **lazy** (só na primeira necessidade) e o modelo fica em memória entre
ciclos. Referência de desempenho no M4: ~40s por resumo com os parâmetros atuais.

### Parâmetros de geração (ajustados para o M4)
- `NUM_BEAMS = 1` (geração gulosa; sem `repetition_penalty`/`no_repeat_ngram_size`,
  que corrompiam a saída estruturada em modo guloso).
- `MAX_NEW_TOKENS = 450`, `MIN_NEW_TOKENS = 180` — teto baixo evita geração
  degenerada (modelo que não emite EOS geraria até o limite, travando por minutos).
- `MAX_NOTICIA_TOKENS = 1200` — trunca a entrada (~900 palavras); como cada token
  gerado reprocessa todo o contexto, artigo grande sem esse corte fica muito lento.
- Resumo final mirando ~650 caracteres (máx. 800), cortado por frase.

---

## 9. Configuração (`.env`)

```
DATABASE_URL=postgresql://app:app@localhost:5434/noticias?schema=public
HF_TOKEN=hf_xxx                       # token do HuggingFace (baixar modelos)
HF_HOME=./hf_cache                    # cache local dos modelos
POLL_INTERVAL_SECONDS=60
JOB_TIMEOUT_MINUTOS=30                # reaper de jobs travados
BUSCADOR_MODEL=Qwen/Qwen2.5-1.5B-Instruct
BUSCADOR_N_CANDIDATOS=10
BUSCADOR_TOP_K=2
BUSCADOR_LINGUA=pt
BUSCADOR_PAIS=BR
BUSCADOR_MAX_IDADE_DIAS=7
RESUMIDOR_MODEL=Qwen/Qwen2.5-3B-Instruct
```

O parâmetro `?schema=` é sintaxe do Prisma; `db.py` o remove antes de passar ao
`psycopg2` (e aplica `search_path` se o schema não for `public`).

---

## 10. Como rodar

```bash
cd agentes
cp .env.example .env      # preencher DATABASE_URL e HF_TOKEN
uv sync
uv run playwright install chromium   # só 1x
uv run python main.py     # loop infinito; Ctrl+C para parar
```

Requisito: uma keyword **ativa** no banco. Como o agente nunca escreve em `keywords`,
ela precisa vir da interface (ou, para teste, `INSERT` manual). Sem keyword ativa, o
loop roda sem nada a fazer.

---

## 11. Como a interface consome (referência)

```sql
-- feed de notícias de uma keyword
SELECT n.*
FROM news_items n
JOIN news_keyword_matches m ON m.news_item_id = n.id
WHERE m.keyword_id = :keyword_id
ORDER BY n.fetched_at DESC;

-- status / saúde de uma busca
SELECT status, erro_msg, started_at, finished_at
FROM search_jobs WHERE keyword_id = :keyword_id;

-- "última execução bem-sucedida" (indicador de saúde)
SELECT MAX(finished_at) FROM search_jobs WHERE status = 'concluido';

-- disparar busca imediata (job manual, prioridade no polling)
INSERT INTO search_jobs (keyword_id, status, origem)
VALUES (:keyword_id, 'pendente', 'manual');
```

---

## 12. Limitações conhecidas

- **Desempenho:** ~40s por resumo no M4 (sem GPU dedicada). É o gargalo principal.
- **`relevancia` fica `NULL` hoje:** a seleção é qualitativa (LLM), sem score numérico.
  Isso passa a ser preenchido quando os termos relacionados entrarem (ver §13).
- **`principais_temas`/`assunto` são descartados:** o modelo os gera, mas não vão ao
  banco (só o parágrafo do resumo é gravado). Candidatos naturais a enriquecer o card
  no futuro (exigiria colunas novas = migration da interface).
- **Fontes com paywall** (Folha, Estadão, Valor, O Globo, Veja, etc.) ficam fora da
  lista permitida de propósito — o resumidor não extrai texto atrás de login.
- **Decodificação de URL do Google News** depende de formato interno do Google
  (cascata de fallbacks); é robusta mas pode quebrar se o Google mudar.

---

## 13. Evolução: Assunto + termos relacionados (planejado)

Muda o conceito de `keyword` (um termo único) para **Assunto**: um tema principal
("Guerra na Ucrânia") acompanhado de uma lista de **termos relacionados**
(drone, fuzil, míssil, OTAN…) que o cliente cadastra na interface.

### Schema (aditivo, decidido: coluna array)
Uma única coluna nova em `keywords`, sem tabela nova nem renomear nada:

```sql
ALTER TABLE "keywords"
  ADD COLUMN "termos_relacionados" TEXT[] NOT NULL DEFAULT '{}';
```

`NOT NULL DEFAULT '{}'` → keywords antigas ficam com array vazio; array vazio =
comportamento atual (busca só pelo nome). `search_jobs`, `news_keyword_matches` e todo
o resto ficam **inalterados** (continuam usando `keyword_id`).

> Spec completo para o front em **`CONTRATO_ASSUNTOS_FRONT.md`**.

### Como o backend vai usar (quando a migration estiver aplicada)
Permissão inalterada (só leitura de `keywords`). Os termos entram em 3 pontos:

1. **Busca** — pelo nome do assunto e, opcionalmente, combinações com os termos, para
   ampliar a cobertura.
2. **Ranqueamento / `relevancia`** — pontua cada candidato pela presença dos termos no
   título/resumo. Isso **passa a preencher `news_items.relevancia`** (hoje `NULL`),
   permitindo à interface ordenar/filtrar o feed por relevância.
3. **Contexto do LLM seletor** — os termos vão no prompt ("assunto: … ; termos
   relacionados: …") para escolher as melhores notícias com mais precisão.

### Mudanças previstas no código (ainda não aplicadas)
- `models.py`: mapear a coluna `termos_relacionados` na `Keyword`.
- `buscador.py`: ranquear candidatos pelos termos + passá-los ao seletor + calcular o
  score de relevância.
- `orchestrator.py`: gravar `relevancia` no `upsert_news_item`.

### Sequência combinada
1. **Front aplica a migration** (adiciona `termos_relacionados`) e sobe a UI de tags.
2. **Backend liga o uso** dos termos — *só depois* da migration (antes disso, mapear a
   coluna quebraria o `SELECT` em `keywords`).
