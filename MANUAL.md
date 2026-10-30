# Manual de Instalação e Operação — Sistema de Notícias para Apoio à Decisão

Este manual leva uma pessoa **do zero absoluto** (máquina limpa, sem nada
instalado) até o sistema completo rodando: banco de dados, interface web e
agentes de IA. Também explica **cada configuração** existente, o que ela faz e
quando mexer nela.

> Convenções: blocos `bash` são comandos para copiar e colar no terminal. O
> caminho `pfc_2026/` é a pasta onde o repositório foi clonado. Onde algo **não
> pôde ser verificado** a partir deste repositório, isso está dito
> explicitamente.

---

## Sumário

1. [Visão geral do sistema](#1-visão-geral-do-sistema)
2. [Estrutura do repositório](#2-estrutura-do-repositório)
3. [Pré-requisitos](#3-pré-requisitos)
4. [Instalação do zero, passo a passo](#4-instalação-do-zero-passo-a-passo)
5. [Configuração da interface web (`web/`)](#5-configuração-da-interface-web-web)
6. [Configuração dos agentes (`agentes/`)](#6-configuração-dos-agentes-agentes)
7. [O servidor de LLMs (vLLM na VM com GPU)](#7-o-servidor-de-llms-vllm-na-vm-com-gpu)
8. [Como o sistema funciona por dentro](#8-como-o-sistema-funciona-por-dentro)
9. [Operação do dia a dia](#9-operação-do-dia-a-dia)
10. [Rodando em produção (servidor/VM)](#10-rodando-em-produção-servidorvm)
11. [Verificação e testes](#11-verificação-e-testes)
12. [Solução de problemas](#12-solução-de-problemas)
13. [Regras que não podem ser quebradas](#13-regras-que-não-podem-ser-quebradas)
14. [Checklist final](#14-checklist-final)

---

## 1. Visão geral do sistema

O sistema busca notícias na web a partir de **assuntos** (palavras-chave)
cadastrados pelo usuário, gera um **resumo** de cada notícia com um modelo de
linguagem (LLM) e exibe tudo num **painel web**.

São quatro peças:

```
                         ┌──────────────────────────────┐
                         │  VM com GPU (via VPN)        │
                         │  vLLM :8000 → Qwen  (seleção)│
                         │  vLLM :8003 → Gemma (resumo) │
                         └──────────────▲───────────────┘
                                        │ HTTP (API compatível com OpenAI)
                                        │
┌───────────────────┐           ┌───────┴───────────┐
│ Interface web     │           │ Agentes de IA     │
│ (Next.js, :3000)  │           │ (Python, poller)  │
└────────┬──────────┘           └───────┬───────────┘
         │  lê notícias/jobs            │  lê assuntos ativos
         │  escreve assuntos/config     │  escreve jobs e notícias
         ▼                              ▼
       ┌────────────────────────────────────┐
       │ PostgreSQL 16 (Docker, porta 5434) │
       └────────────────────────────────────┘
```

| Peça | Pasta | O que faz |
|---|---|---|
| **Banco de dados** | `web/docker-compose.yml` | PostgreSQL 16 num container Docker. É o único ponto de contato entre a interface e os agentes. |
| **Interface web** | `web/` | Painel em Next.js: feed de notícias, gráficos, status da coleta, cadastro de assuntos e configurações. |
| **Agentes de IA** | `agentes/` | Processo Python em loop: lê os assuntos ativos, busca notícias no Google News, escolhe as mais relevantes, extrai o texto, resume e grava no banco. |
| **Servidor de LLMs** | fora do repositório (VM) | Dois modelos servidos pelo **vLLM** numa máquina virtual com GPU, acessada pela **VPN**. Os agentes chamam esses modelos por HTTP. |

### A regra de ouro da arquitetura

**A interface e os agentes nunca conversam diretamente.** Não existe API,
endpoint, webhook nem fila entre eles. Toda a comunicação acontece pelo estado
gravado no banco:

- a interface cadastra um assunto → os agentes o descobrem no próximo ciclo de
  polling;
- os agentes terminam uma busca → gravam `finished_at` no job, e a interface
  mostra isso na próxima vez que a página é carregada.

Consequência prática: **cada peça funciona sozinha.** A interface abre e mostra o
último estado conhecido mesmo com os agentes desligados, e os agentes rodam com
a interface desligada.

---

## 2. Estrutura do repositório

```
pfc_2026/
├── MANUAL.md                ← este arquivo
├── README.md                ← resumo curto + link para este manual
├── .gitignore
│
├── agentes/                 ← camada de IA (Python)
│   ├── .env.example         ← modelo das variáveis de ambiente (versionado)
│   ├── .env                 ← suas variáveis reais (NÃO versionado)
│   ├── pyproject.toml       ← dependências Python
│   ├── uv.lock              ← versões travadas das dependências
│   ├── main.py              ← ponto de entrada (configura log e inicia o loop)
│   ├── config.py            ← lê o .env, valores padrão, lista de fontes
│   ├── poller.py            ← loop de polling (reaper, jobs manuais, agendamento)
│   ├── orchestrator.py      ← pipeline de um job: buscar → resumir → gravar
│   ├── buscador.py          ← Google News + seleção das melhores notícias via LLM
│   ├── google_news.py       ← converte links do Google News na URL real da matéria
│   ├── resumidor.py         ← extrai o texto do artigo + gera o resumo via LLM
│   ├── llm_client.py        ← cliente HTTP dos LLMs (vLLM / API OpenAI)
│   ├── repository.py        ← todas as consultas e escritas no banco
│   ├── models.py            ← mapeamento das tabelas (SQLAlchemy)
│   └── db.py                ← conexão com o Postgres
│
└── web/                     ← interface (Next.js)
    ├── env.example          ← modelo do .env (versionado)
    ├── .env                 ← suas variáveis reais (NÃO versionado)
    ├── docker-compose.yml   ← sobe o PostgreSQL
    ├── package.json         ← dependências e scripts npm
    ├── prisma.config.ts     ← configuração do Prisma (schema, migrations, seed)
    ├── prisma/
    │   ├── schema.prisma    ← definição das tabelas (fonte da verdade do banco)
    │   ├── migrations/      ← histórico de alterações do banco
    │   └── seed.ts          ← dados fictícios (APAGA o banco — ver §5.6)
    ├── docs/CONTRATO.md     ← contrato de schema entre interface e agentes
    ├── CLAUDE.md, AGENTS.md ← instruções para o Claude Code nesta pasta
    └── src/
        ├── app/             ← páginas (/, /configuracoes, /configuracoes/assuntos/[id])
        ├── components/      ← componentes visuais
        ├── lib/db/          ← prisma.ts (conexão), queries.ts (leituras), actions.ts (escritas)
        ├── lib/mock/        ← modo de apresentação (ver §5.7)
        └── generated/prisma ← cliente Prisma gerado automaticamente (não versionado)
```

---

## 3. Pré-requisitos

### 3.1 Software

Versões em que o projeto **foi testado** (macOS, Apple Silicon):

| Ferramenta | Versão testada | Mínimo | Para quê |
|---|---|---|---|
| Git | qualquer recente | — | clonar o repositório |
| Docker Desktop | Docker 28.5 / Compose v2.40 | Compose v2 (`docker compose`, com espaço) | rodar o PostgreSQL |
| Node.js | 24.10 | **20** | interface web |
| npm | 11.9 | o que vem com o Node | dependências da interface |
| uv | 0.10.11 | — | gerenciador Python dos agentes (instala o Python sozinho) |
| Python | 3.12 (instalado pelo `uv`) | **3.11** | agentes |

Instalação no macOS (com [Homebrew](https://brew.sh)):

```bash
brew install git node uv
brew install --cask docker     # Docker Desktop — depois abra o app uma vez
```

Instalação no Ubuntu/Debian:

```bash
sudo apt update && sudo apt install -y git curl
# Docker + plugin Compose
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER          # depois saia e entre de novo na sessão
# Node.js 20+ via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc && nvm install 20
# uv
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Confira tudo:

```bash
git --version && docker --version && docker compose version \
  && node --version && npm --version && uv --version
```

### 3.2 Acesso à rede

- **Internet**: os agentes consultam o Google News e baixam as matérias dos
  sites de notícia.
- **VPN do laboratório**: o servidor de LLMs (`se9-proxmox2`, IP
  `192.168.91.172`) fica numa rede privada. **Sem a VPN conectada, os agentes
  não conseguem gerar nada** — todos os jobs terminam em erro. A interface e o
  banco funcionam sem VPN.

### 3.3 Hardware

A máquina que roda interface + banco + agentes **não precisa de GPU**: nenhum
modelo é carregado localmente. Qualquer notebook moderno serve. Reserve ~1 GB
de disco para dependências (Node + Python + navegador do Playwright) e o
espaço que o banco ocupar.

---

## 4. Instalação do zero, passo a passo

A ordem importa: **banco → interface (cria as tabelas) → agentes.** Os agentes
não criam tabela nenhuma; se forem iniciados antes das migrations da interface,
falham ao consultar o banco.

### Passo 1 — Clonar o repositório

```bash
git clone https://github.com/arthurmartinsc1/pfc_2026.git
cd pfc_2026
```

### Passo 2 — Subir o banco de dados

Garanta que o Docker Desktop está **aberto** (ícone da baleia na barra de menu)
e rode:

```bash
cd web
cp env.example .env
docker compose up -d
docker compose ps        # a coluna STATUS deve mostrar "Up"
```

Isso cria um container `pfc_web-db-1` com PostgreSQL 16, acessível em
`localhost:5434`, com usuário `app`, senha `app` e banco `noticias`. Os dados
ficam no volume Docker `pfc_web_db_data` e sobrevivem a reinícios.

### Passo 3 — Instalar e preparar a interface

Ainda dentro de `web/`:

```bash
npm install                  # instala dependências e roda `prisma generate`
npx prisma migrate deploy    # cria as tabelas no banco
```

O `migrate deploy` deve listar as 5 migrations aplicadas (ou dizer que não há
nada pendente, se o banco já existia).

### Passo 4 — Rodar a interface

```bash
npm run dev
```

Abra <http://localhost:3000>. Deixe esse terminal aberto.

> **Atenção ao modo de apresentação.** O repositório está hoje com
> `MODO_APRESENTACAO = true`: o feed mostra **notícias fictícias** em vez das do
> banco. Para ver dados reais, leia a §5.7.

### Passo 5 — Configurar os agentes

Em **outro terminal**, a partir da raiz do repositório:

```bash
cd agentes
cp .env.example .env
```

Edite o `agentes/.env` e troque `<IP_VPN_DA_VM>` pelo IP do servidor de LLMs
(hoje `192.168.91.172`) nas duas URLs e coloque em `LLM_API_KEY` a chave
combinada com o servidor. Todas as variáveis estão explicadas na §6.

### Passo 6 — Instalar as dependências dos agentes

```bash
uv sync                              # cria agentes/.venv e instala tudo
uv run playwright install chromium   # navegador usado para sites em JavaScript (só 1x)
```

O `uv sync` baixa um Python ≥ 3.11 automaticamente se a máquina não tiver.

### Passo 7 — Conectar a VPN e conferir o servidor de LLMs

```bash
curl -s http://192.168.91.172:8000/v1/models -H "Authorization: Bearer <LLM_API_KEY>"
curl -s http://192.168.91.172:8003/v1/models -H "Authorization: Bearer <LLM_API_KEY>"
```

Cada comando deve devolver um JSON listando o modelo (`qwen` e `gemma`). Se der
timeout ou "connection refused", veja a §12.

### Passo 8 — Rodar os agentes

```bash
uv run main.py
```

O terminal passa a mostrar o log do loop (`Polling iniciado (intervalo=60s)`,
`Iniciando ciclo de polling...`). Para parar: `Ctrl+C`.

### Passo 9 — Cadastrar um assunto e ver a primeira coleta

1. Em <http://localhost:3000/configuracoes>, crie um assunto (ex.: "Marinha do
   Brasil"), ativo, com um intervalo em minutos.
2. Em até ~60 s os agentes pegam o assunto (ele é "novo", então está devido) e
   o log mostra a busca, a seleção e os resumos.
3. Com o modo de apresentação desligado, recarregue <http://localhost:3000>: as
   notícias aparecem no feed e o indicador de coleta fica verde.

---

## 5. Configuração da interface web (`web/`)

### 5.1 Variáveis de ambiente — `web/.env`

O arquivo tem **uma** variável:

```env
DATABASE_URL="postgresql://app:app@localhost:5434/noticias?schema=public"
```

Anatomia da URL:

| Parte | Valor | Significado |
|---|---|---|
| `postgresql://` | — | protocolo |
| `app` (antes do `:`) | usuário | igual a `POSTGRES_USER` no `docker-compose.yml` |
| `app` (depois do `:`) | senha | igual a `POSTGRES_PASSWORD` |
| `localhost` | host | onde o Postgres está; outra máquina → IP dela |
| `5434` | porta **do host** | o lado esquerdo de `"5434:5432"` no compose |
| `noticias` | banco | igual a `POSTGRES_DB` |
| `?schema=public` | schema | sintaxe do Prisma; `public` é o padrão do Postgres |

Quem lê essa variável:

- o **Next.js** (carrega `.env` sozinho) — usado em `src/lib/db/prisma.ts`;
- o **Prisma CLI** (`prisma.config.ts` faz `import "dotenv/config"`) — usado por
  `migrate`, `studio` e `seed`.

O `.env` **não vai para o git** (`web/.gitignore` ignora `.env*`). O modelo
versionado é o `env.example`.

### 5.2 Banco de dados — `web/docker-compose.yml`

```yaml
name: pfc_web
services:
  db:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
      POSTGRES_DB: noticias
    ports:
      - "5434:5432"
    volumes:
      - db_data:/var/lib/postgresql/data
volumes:
  db_data:
```

| Campo | O que faz | Quando mexer |
|---|---|---|
| `name: pfc_web` | Fixa o nome do projeto Compose. O volume vira `pfc_web_db_data`. | **Não mude.** Sem ele (ou com outro nome), o Compose cria um volume novo e vazio e o banco "some" — os dados continuam no volume antigo, mas o container novo não os enxerga. |
| `image: postgres:16` | Versão do Postgres. | Só com migração planejada dos dados. |
| `restart: unless-stopped` | O container volta sozinho quando o Docker reinicia. | — |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Credenciais e nome do banco. **Só valem na primeira criação do volume.** | Em produção, troque e replique nos dois `.env` (web e agentes). Para trocar num volume já criado, altere a senha via `psql` (`ALTER USER app PASSWORD '...'`). |
| `ports: "5434:5432"` | Porta 5434 da sua máquina → porta 5432 do container. A 5434 evita conflito com um Postgres local na 5432. | Se a 5434 estiver ocupada, mude o número da esquerda e atualize o `DATABASE_URL` dos **dois** `.env`. |
| `volumes: db_data` | Onde os dados ficam persistidos. | — |

Comandos úteis (rodar de dentro de `web/`):

```bash
docker compose up -d                          # sobe
docker compose stop                           # para (mantém os dados)
docker compose ps                             # status
docker compose logs -f db                     # logs do Postgres
docker compose exec db psql -U app -d noticias   # console SQL
```

> **Nunca rode `docker compose down -v`** sem querer apagar o banco: o `-v`
> remove o volume com todas as notícias coletadas.

### 5.3 Schema e migrations — `web/prisma/`

O `schema.prisma` é a **fonte da verdade** das tabelas. Quem cria e altera
tabelas é **sempre a interface**, via migrations do Prisma. Os agentes nunca
rodam `CREATE`/`ALTER TABLE`.

Tabelas:

| Tabela | Conteúdo | Quem escreve |
|---|---|---|
| `keywords` | Assuntos monitorados: `termo`, `ativo`, `intervalo_minutos`, `termos_relacionados` (lista) | Interface |
| `search_jobs` | Cada execução de busca: `status` (`pendente`/`rodando`/`concluido`/`erro`), `origem` (`agendado`/`manual`), `started_at`, `finished_at`, `erro_msg` | Agentes (interface pode criar job manual) |
| `news_items` | Notícias resumidas, **URL única**: `titulo`, `url`, `fonte`, `resumo`, `relevancia`, `data_publicacao_original`, `fetched_at`, `descartada` | Agentes (só `descartada` é da interface) |
| `news_keyword_matches` | Vínculo N:N notícia ↔ assunto ↔ job | Agentes |
| `app_settings` | Configurações da interface (linha única `id='default'`) | Interface |

Migrations existentes (aplicadas em ordem):

1. `20260802032551_init_contrato` — tabelas do contrato e enums.
2. `20260802033859_add_descartada_news_items` — coluna `descartada`.
3. `20260802035111_add_app_settings` — tabela `app_settings`.
4. `20260806135529_add_termos_relacionados_keywords` — coluna `termos_relacionados`.
5. `20260806135806_termos_relacionados_not_null` — torna a coluna obrigatória com default `{}`.

Detalhes que pegam quem escreve SQL à mão:

- Chaves primárias são `UUID` com `DEFAULT gen_random_uuid()`: omita o `id` no
  `INSERT`.
- Os enums se chamam `"JobStatus"` e `"JobOrigin"` (**com aspas**, PascalCase), e
  os valores são minúsculos e **sem acento**: `'concluido'`, não `'concluído'`.

Comandos:

| Comando | Para quê |
|---|---|
| `npx prisma migrate deploy` | Aplica migrations pendentes. **É o que se usa para instalar/atualizar.** |
| `npx prisma migrate dev --name <nome>` | Cria uma migration nova após editar o `schema.prisma` (só em desenvolvimento). |
| `npx prisma generate` | Regenera o cliente em `src/generated/prisma` (o `npm install` já faz isso). |
| `npx prisma studio` | Abre uma interface visual do banco no navegador. |

O contrato completo, com a divisão de responsabilidades, está em
[`web/docs/CONTRATO.md`](web/docs/CONTRATO.md).

### 5.4 Scripts npm — `web/package.json`

| Comando | O que faz |
|---|---|
| `npm install` | Instala dependências; o `postinstall` roda `prisma generate`. |
| `npm run dev` | Servidor de desenvolvimento em <http://localhost:3000>, com recarga automática. |
| `npm run build` | Build de produção (pasta `.next/`). |
| `npm run start` | Serve o build de produção na porta 3000 (`npm run start -- -p 8080` para outra porta). |
| `npm run lint` | ESLint. |

Stack: Next.js 16 (App Router, Turbopack), React 19, Prisma 7 com driver `pg`,
Tailwind CSS 4, TypeScript 5.

### 5.5 Telas e configurações dentro da interface

| Tela | O que tem | Onde grava |
|---|---|---|
| `/` (painel) | Feed de notícias, filtros por assunto, gráfico de notícias por dia (14 dias), gráfico de pizza por assunto, indicador de saúde da coleta, botão de descartar notícia | `news_items.descartada` |
| `/configuracoes` | Cadastro/edição/remoção de assuntos (termo, ativo, intervalo), status da última busca de cada assunto, configurações gerais | `keywords`, `app_settings` |
| `/configuracoes/assuntos/[id]` | Termos relacionados de um assunto (chips) | `keywords.termos_relacionados` |

Configurações e o que elas realmente fazem:

- **Assunto ativo** (`keywords.ativo`): só assuntos ativos são buscados.
- **Intervalo em minutos** (`keywords.intervalo_minutos`): de quanto em quanto
  tempo o assunto é buscado de novo. Mudanças valem no próximo ciclo dos agentes,
  sem reiniciar nada.
- **Termos relacionados**: palavras auxiliares (ex.: "drone", "OTAN" para
  "Guerra na Ucrânia"). Os agentes fazem uma busca extra para cada termo
  (`"<assunto> <termo>"`), usam os termos no prompt de seleção e calculam a
  `relevancia` (fração dos termos presentes no título/trecho). Com 0 termos, a
  busca é só pelo nome do assunto.
- **Limite de notícias exibidas** (`app_settings.limite_noticias_exibidas`,
  padrão 10): quantas notícias o feed mostra por página.
- **Canais dos agentes** (formulário em configurações): é **apenas visual** —
  fica salvo no `localStorage` do navegador e **não afeta os agentes**. As fontes
  realmente usadas são as de `FONTES_PERMITIDAS` em `agentes/config.py` (§6.3).

O **indicador de saúde** do painel roda
`SELECT MAX(finished_at) FROM search_jobs WHERE status = 'concluido'` e mostra:

| Situação | Cor | Mensagem |
|---|---|---|
| Nenhum job no banco | cinza | aguardando a primeira execução |
| Há jobs, mas nenhum concluído com `finished_at` | vermelho | nenhuma busca concluída |
| Último concluído há mais de 24 h | vermelho | sem novas buscas há mais de 24 h |
| Último concluído há menos de 24 h | verde | última atualização: data/hora |

### 5.6 Dados fictícios (seed) — CUIDADO

```bash
npx prisma db seed
```

Popula o banco com assuntos e notícias de exemplo. **Antes de inserir, ele APAGA
todas as notícias, vínculos, jobs e assuntos existentes** (`deleteMany` em
`prisma/seed.ts`). Use só num banco de testes. **Nunca rode no banco com a
coleta real.**

### 5.7 Modo de apresentação — `web/src/lib/mock/apresentacao.ts`

```ts
export const MODO_APRESENTACAO = true;
```

É um interruptor único que existe para gravar/apresentar o sistema quando a VM
de LLMs está inacessível:

- **`true` (estado atual do repositório)**: o feed, os gráficos, o indicador de
  saúde e o status por assunto mostram uma coleta **fictícia e recente**, gerada
  em memória. Os assuntos exibidos são os reais do banco. **Nada é gravado no
  banco**; descartar uma notícia fictícia só vale até o servidor reiniciar.
- **`false`**: tudo volta a ler o banco — é o modo para uso real e para testar
  a integração com os agentes.

Depois de mudar, reinicie o `npm run dev` (ou refaça `npm run build` em
produção).

---

## 6. Configuração dos agentes (`agentes/`)

### 6.1 Variáveis de ambiente — `agentes/.env`

O `config.py` carrega o `.env` com `python-dotenv`. Variáveis marcadas como
**obrigatórias** derrubam o processo na inicialização (`KeyError`) se estiverem
ausentes.

#### Banco de dados

| Variável | Obrigatória | Padrão | Descrição |
|---|---|---|---|
| `DATABASE_URL` | **sim** | — | Mesma URL do `web/.env`. Ex.: `postgresql://app:app@localhost:5434/noticias?schema=public`. O `?schema=` (sintaxe do Prisma) é removido em `db.py` antes de chegar ao `psycopg2`; se o schema não for `public`, ele é aplicado via `search_path`. Se os agentes rodarem dentro de outro container Docker, troque `localhost` por `host.docker.internal` (Mac/Windows). |

#### Servidor de LLMs

| Variável | Obrigatória | Padrão | Descrição |
|---|---|---|---|
| `LLM_API_KEY` | não | `EMPTY` | Segredo compartilhado com o servidor: o mesmo valor passado em `--api-key` no `vllm serve`. "EMPTY" é um valor literal, não ausência de senha. Vale para os dois modelos. |
| `LLM_TIMEOUT_SECONDS` | não | `240` | Tempo máximo de **uma** chamada ao LLM. Se estourar, aquela chamada falha e o pipeline segue (o job ou o artigo é marcado como falha), em vez de travar o loop para sempre. |

#### Loop de polling

| Variável | Obrigatória | Padrão | Descrição |
|---|---|---|---|
| `POLL_INTERVAL_SECONDS` | não | `60` | Pausa entre o fim de um ciclo e o início do próximo. Define o tempo máximo até um assunto novo ou um job manual ser percebido. |
| `JOB_TIMEOUT_MINUTOS` | não | `30` | Um job em `rodando` há mais que isso é considerado travado (processo morreu no meio) e vira `erro` no próximo ciclo. Não está no `.env.example`, mas pode ser definido. |

#### Buscador (encontrar e selecionar notícias)

| Variável | Obrigatória | Padrão | Descrição |
|---|---|---|---|
| `BUSCADOR_LLM_BASE_URL` | **sim** | — | URL do vLLM que faz a seleção. Hoje `http://192.168.91.172:8000/v1`. Precisa terminar em `/v1`. |
| `BUSCADOR_LLM_MODEL` | não | `qwen` | Nome do modelo **como registrado no vLLM** (`--served-model-name`), não o nome do HuggingFace. Confira com `curl <url>/models`. |
| `BUSCADOR_N_CANDIDATOS` | não | `10` | Máximo de resultados pedidos ao Google News **por consulta** (a busca principal e cada termo relacionado são consultas separadas). |
| `BUSCADOR_TOP_K` | não | `2` | Quantas notícias são escolhidas para resumir por job. Se houver ≤ TOP_K candidatos, todos passam sem chamar o LLM. **É o principal controle de custo/tempo**: cada uma vira uma chamada ao resumidor. |
| `BUSCADOR_LINGUA` | não | `pt` | Idioma das notícias no Google News. |
| `BUSCADOR_PAIS` | não | `BR` | País/edição do Google News. |
| `BUSCADOR_MAX_IDADE_DIAS` | não | `7` | Só notícias publicadas nos últimos N dias. Valores 1, 2, 3, 7, 14 e 30 são mapeados para os períodos do Google News; outros viram `"<N>d"`. |

#### Resumidor (gerar o resumo)

| Variável | Obrigatória | Padrão | Descrição |
|---|---|---|---|
| `RESUMIDOR_LLM_BASE_URL` | **sim** | — | URL do vLLM que gera os resumos. Hoje `http://192.168.91.172:8003/v1`. |
| `RESUMIDOR_LLM_MODEL` | não | `gemma` | Nome do modelo registrado no vLLM da porta 8003. |

Exemplo completo de `agentes/.env`:

```env
DATABASE_URL=postgresql://app:app@localhost:5434/noticias?schema=public

LLM_API_KEY=<segredo combinado com o servidor>
LLM_TIMEOUT_SECONDS=240

POLL_INTERVAL_SECONDS=60
JOB_TIMEOUT_MINUTOS=30

BUSCADOR_LLM_BASE_URL=http://192.168.91.172:8000/v1
BUSCADOR_LLM_MODEL=qwen
BUSCADOR_N_CANDIDATOS=10
BUSCADOR_TOP_K=2
BUSCADOR_LINGUA=pt
BUSCADOR_PAIS=BR
BUSCADOR_MAX_IDADE_DIAS=7

RESUMIDOR_LLM_BASE_URL=http://192.168.91.172:8003/v1
RESUMIDOR_LLM_MODEL=gemma
```

O `.env` **não vai para o git** (`.gitignore` da raiz). Só o `.env.example`.

> Mudanças no `.env` só valem depois de **reiniciar** os agentes (`Ctrl+C` e
> `uv run main.py` de novo). Já as mudanças feitas pela interface (assuntos,
> intervalos, termos) valem no próximo ciclo, sem reiniciar.

### 6.2 Dependências — `agentes/pyproject.toml`

| Pacote | Uso |
|---|---|
| `sqlalchemy`, `psycopg2-binary` | Acesso ao PostgreSQL |
| `python-dotenv` | Leitura do `.env` |
| `gnews` | Busca no Google News (RSS) |
| `googlenewsdecoder`, `requests`, `beautifulsoup4`, `lxml` | Resolver o link do Google News para a URL real da matéria |
| `trafilatura` | Extrair o texto principal de uma página de notícia |
| `playwright` | Navegador headless para sites que só renderizam com JavaScript |
| `openai` | Cliente HTTP para a API do vLLM (compatível com a da OpenAI) |

`uv sync` instala exatamente as versões do `uv.lock`. Para adicionar um pacote:
`uv add <pacote>`.

### 6.3 Configurações que estão no código (não no `.env`)

Algumas configurações são constantes no código. Para mudá-las, edite o arquivo
e reinicie os agentes.

**`agentes/config.py` → `FONTES_PERMITIDAS`**

Lista de veículos aceitos. Uma notícia do Google News só vira candidata se o
nome do veículo **contiver** algum item da lista (comparação sem acento e sem
diferenciar maiúsculas). Hoje inclui veículos gratuitos generalistas (G1, CNN
Brasil, BBC, UOL, Agência Brasil, Poder360, Metrópoles, Reuters…), de
defesa/cibersegurança (DefesaNet, Tecnodefesa, Poder Aéreo, Forças Terrestres,
CISO Advisor…) e fontes oficiais (gov.br, Marinha, Exército, FAB).

Veículos com **paywall** (Folha, Estadão, Valor, O Globo, Veja, Exame…) ficam
**fora de propósito**: o extrator não consegue ler o texto atrás do login, e o
resumo sairia vazio ou errado. Para adicionar uma fonte, inclua o nome como ele
aparece no Google News (em minúsculas).

**`agentes/resumidor.py`**

| Constante | Valor | Efeito |
|---|---|---|
| `MAX_NEW_TOKENS` | 700 | Teto de tokens gerados por resumo. |
| `MIN_NEW_TOKENS` | 180 | Mínimo de tokens (evita resumo curto demais). Enviado ao vLLM como `min_tokens`. |
| `MAX_NOTICIA_TOKENS` | 6000 | Tamanho máximo do texto da matéria enviado ao modelo (estimado em 4 caracteres por token; o excedente é cortado). |
| `RESUMO_ALVO_CHARS` / `RESUMO_MAX_CHARS` | 800 / 1000 | Tamanho-alvo e máximo do resumo final gravado; o corte é feito no fim de uma frase. |
| `SYSTEM_PROMPT` / `USER_TEMPLATE_CURTO` | — | Prompt do resumidor. O modelo responde com `ASSUNTO`, `PRINCIPAIS TEMAS` e `RESUMO`; **só o texto do `RESUMO` vai para o banco**. |

**`agentes/buscador.py`**: a chamada de seleção usa `max_tokens=150` e espera
uma resposta com `ESCOLHIDOS: <números>`. Se a resposta não puder ser
interpretada, os primeiros TOP_K candidatos são usados.

**`agentes/llm_client.py`**: toda chamada usa `temperature=0.0` (saída
determinística) e envia `chat_template_kwargs: {"enable_thinking": false}`, que
desliga o "modo raciocínio" do Qwen3 (sem isso ele gasta todos os tokens
"pensando" e não devolve resposta). Modelos que não suportam a opção a ignoram.

---

## 7. O servidor de LLMs (vLLM na VM com GPU)

### 7.1 O que é

O **vLLM** é um servidor de inferência que carrega um modelo de linguagem na GPU
e expõe uma API HTTP **compatível com a da OpenAI** (`/v1/chat/completions`,
`/v1/models`). Por isso os agentes usam a biblioteca `openai` do Python,
apontando para o servidor do laboratório em vez da OpenAI. Nenhum peso de
modelo fica na máquina dos agentes.

### 7.2 O que está configurado hoje

| Item | Valor |
|---|---|
| Máquina | `se9-proxmox2` (VM num host Proxmox do laboratório) |
| IP | `192.168.91.172` (rede privada, só pela VPN) |
| Acesso SSH | usuário `portes` |
| Modelo de seleção | porta **8000**, nome servido `qwen` (família Qwen3) |
| Modelo de resumo | porta **8003**, nome servido `gemma` |
| Autenticação | `--api-key` = valor de `LLM_API_KEY` |

> **Não verificado a partir deste repositório:** o comando exato usado para subir
> os modelos na VM (checkpoint do HuggingFace, tamanho de contexto, memória de
> GPU) não está versionado aqui. O que se sabe pelo código é que são modelos de
> ~9–12 B parâmetros, com contexto de cerca de 100 mil tokens. Quem tiver acesso
> à VM deve registrar o comando real nesta seção.

### 7.3 Modelo de comando para subir um modelo (exemplo, não verificado)

Formato geral de um `vllm serve` compatível com a configuração dos agentes:

```bash
# Na VM com GPU, num ambiente com vLLM instalado (pip install vllm)
vllm serve <id-do-modelo-no-huggingface> \
  --served-model-name qwen \
  --port 8000 \
  --host 0.0.0.0 \
  --api-key <LLM_API_KEY>

vllm serve <id-do-modelo-no-huggingface> \
  --served-model-name gemma \
  --port 8003 \
  --host 0.0.0.0 \
  --api-key <LLM_API_KEY>
```

Pontos que precisam bater com o `agentes/.env`:

- `--served-model-name` = `BUSCADOR_LLM_MODEL` / `RESUMIDOR_LLM_MODEL`;
- `--port` = a porta nas URLs `*_LLM_BASE_URL`;
- `--api-key` = `LLM_API_KEY`.

### 7.4 Como testar o servidor

```bash
# Lista os modelos disponíveis (prova que rede, porta e chave estão certas)
curl -s http://192.168.91.172:8000/v1/models -H "Authorization: Bearer <LLM_API_KEY>"

# Gera um texto de teste
curl -s http://192.168.91.172:8003/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <LLM_API_KEY>" \
  -d '{"model": "gemma", "messages": [{"role": "user", "content": "Diga ola"}], "max_tokens": 20}'
```

### 7.5 Trocar de modelo ou de servidor

- **Outro modelo no mesmo servidor**: suba-o no vLLM e ajuste
  `*_LLM_MODEL` (e a porta em `*_LLM_BASE_URL`, se mudar).
- **Outro servidor**: mude o IP nas URLs `*_LLM_BASE_URL`.
- **Provedor comercial compatível com a API da OpenAI**: aponte
  `*_LLM_BASE_URL` para a URL do provedor, `LLM_API_KEY` para a chave e
  `*_LLM_MODEL` para o nome do modelo. Não é preciso mudar código.

Reinicie os agentes depois de qualquer mudança.

---

## 8. Como o sistema funciona por dentro

### 8.1 O loop de polling (`agentes/poller.py`)

A cada ciclo, separados por `POLL_INTERVAL_SECONDS`, os agentes fazem, nesta
ordem:

1. **Reaper** — jobs em `rodando` há mais de `JOB_TIMEOUT_MINUTOS` viram `erro`
   (cobre um processo que morreu no meio de um job).
2. **Jobs manuais** — processa os `search_jobs` com `status='pendente'` e
   `origem='manual'`, do mais antigo para o mais novo. Eles têm prioridade.
3. **Assuntos devidos** — para cada assunto ativo **sem nenhum job criado nos
   últimos `intervalo_minutos`**, cria um job `agendado` e o processa. Isso cobre
   tanto assunto novo (nunca buscado) quanto o reagendamento periódico. Qualquer
   job recente, inclusive manual, "zera" o intervalo. A comparação de tempo é
   feita no próprio Postgres, para não haver erro de fuso horário.

Os jobs são processados **um de cada vez**. Um erro inesperado no ciclo é
registrado no log e o loop continua.

### 8.2 O pipeline de um job (`agentes/orchestrator.py`)

```
job → status 'rodando' + started_at
  │
  ├─ 1. BUSCAR (buscador.py)
  │     Google News: consulta "<assunto>" + "<assunto> <termo>" para cada termo relacionado
  │     → descarta fontes fora de FONTES_PERMITIDAS
  │     → resolve o link do Google News para a URL real (google_news.py)
  │     → remove URLs repetidas, calcula 'relevancia' pelos termos relacionados
  │
  ├─ 2. SELECIONAR (LLM qwen, porta 8000)
  │     se há mais candidatos que TOP_K: o LLM escolhe os TOP_K mais relevantes
  │
  ├─ 3. PARA CADA ESCOLHIDA: RESUMIR (resumidor.py)
  │     baixa a página (requests + trafilatura)
  │     → se a página é um app JavaScript ou tem pouco texto: abre no Chromium (Playwright)
  │     → limpa ruído (legendas, "leia também", créditos…)
  │     → LLM gemma (porta 8003) gera ASSUNTO / PRINCIPAIS TEMAS / RESUMO
  │     → guarda só o RESUMO, ajustado para ~800–1000 caracteres
  │
  ├─ 4. GRAVAR (repository.py)
  │     INSERT em news_items ... ON CONFLICT (url) DO NOTHING   (sem duplicar)
  │     INSERT do vínculo em news_keyword_matches
  │
  └─ job → 'concluido' + finished_at
       ou 'erro' + finished_at + erro_msg
```

Regras de falha:

- Nenhum candidato encontrado → job em **erro** ("Nenhuma noticia encontrada").
- Falha ao resumir **um** artigo → ele é pulado e o job continua.
- **Todos** os artigos falharam → job em **erro**.
- Uma notícia nunca é gravada sem resumo.
- Uma URL que já existe **não é atualizada**: só ganha o vínculo novo. Assim,
  uma notícia descartada pelo usuário continua descartada.

### 8.3 Tempo e custo de uma execução

Cada job faz 1 chamada de seleção (se houver mais que TOP_K candidatos) + TOP_K
chamadas de resumo. O tempo de cada resumo depende da carga da GPU da VM; o
`LLM_TIMEOUT_SECONDS=240` é o limite por chamada. Com `TOP_K=2`, um job típico
leva de dezenas de segundos a poucos minutos, somando a extração das páginas.

---

## 9. Operação do dia a dia

### Ligar tudo

```bash
# 1. Docker Desktop aberto; então:
cd pfc_2026/web && docker compose up -d

# 2. Interface (terminal 1)
cd pfc_2026/web && npm run dev

# 3. VPN conectada; agentes (terminal 2)
cd pfc_2026/agentes && uv run main.py
```

### Desligar

- Agentes: `Ctrl+C` no terminal deles. Se parar no meio de um job, ele fica em
  `rodando` e o reaper o marca como `erro` depois de `JOB_TIMEOUT_MINUTOS`.
- Interface: `Ctrl+C`.
- Banco: `cd web && docker compose stop` (opcional; os dados ficam).

### Forçar uma busca imediata de um assunto

A interface não tem botão para isso; faça pelo banco:

```bash
cd web && docker compose exec db psql -U app -d noticias
```

```sql
INSERT INTO search_jobs (keyword_id, status, origem)
SELECT id, 'pendente', 'manual' FROM keywords WHERE termo = 'Marinha do Brasil';
```

Os agentes pegam o job no próximo ciclo (até `POLL_INTERVAL_SECONDS`).

### Logs

- **Agentes**: tudo vai para a saída do terminal, com data, nível e módulo.
  Para guardar em arquivo: `uv run main.py 2>&1 | tee agentes.log`.
- **Interface**: saída do `npm run dev`.
- **Banco**: `docker compose logs -f db`.

### Atualizar o código

```bash
cd pfc_2026
git pull
cd web && npm install && npx prisma migrate deploy   # dependências e migrations novas
cd ../agentes && uv sync                             # dependências novas
```

Depois reinicie a interface e os agentes.

---

## 10. Rodando em produção (servidor/VM)

Para deixar o sistema ligado continuamente numa VM (ex.: Ubuntu 22.04/24.04):

1. Instale os pré-requisitos da §3.1 (versão Ubuntu).
2. Clone o repositório e siga a §4 até o passo 3.
3. **Troque as credenciais do banco**: em `web/docker-compose.yml`, mude
   `POSTGRES_USER`/`POSTGRES_PASSWORD` **antes** do primeiro `docker compose up`,
   e replique em `web/.env` e `agentes/.env`.
4. Interface com build de produção e `pm2` (mantém vivo e religa no boot):

   ```bash
   cd pfc_2026/web
   npm run build
   npm install -g pm2
   pm2 start npm --name pfc-web -- start
   pm2 save
   pm2 startup        # siga o comando que ele imprimir
   ```

   Para expor com domínio/HTTPS, use um proxy reverso (Nginx ou Caddy) na frente
   da porta 3000.

5. Agentes com `pm2` também:

   ```bash
   cd pfc_2026/agentes
   uv sync && uv run playwright install --with-deps chromium
   pm2 start "uv run main.py" --name pfc-agentes --cwd "$(pwd)"
   pm2 save
   pm2 logs pfc-agentes      # acompanhar o log
   ```

   > Não verificado neste repositório: o projeto rodou até aqui com os agentes
   > em primeiro plano no terminal. O `pm2` acima é a forma recomendada, mas
   > confira o log depois de configurar.

6. A VM precisa alcançar o servidor de LLMs (mesma rede ou VPN permanente).

Segurança:

- **Nunca exponha a porta do Postgres (5434) na internet.** Se os agentes
  rodarem em outra máquina, libere a porta só para o IP deles no firewall.
- Não use `app:app` em produção.
- Os arquivos `.env` têm segredos: não os envie para o git nem os compartilhe.

---

## 11. Verificação e testes

### 11.1 A interface compila

```bash
cd web
npm run lint
npx tsc --noEmit
npm run build
```

### 11.2 Os agentes enxergam o banco

```bash
cd agentes
uv run python -c "
from sqlalchemy import text
import db
with db.get_session() as s:
    print('assuntos ativos:', s.execute(text('select count(*) from keywords where ativo')).scalar())
    print('noticias:', s.execute(text('select count(*) from news_items')).scalar())
"
```

### 11.3 Conferir o que os agentes gravaram

No console SQL (`cd web && docker compose exec db psql -U app -d noticias`):

```sql
-- últimos jobs
SELECT k.termo, j.status, j.origem, j.started_at, j.finished_at, j.erro_msg
FROM search_jobs j JOIN keywords k ON k.id = j.keyword_id
ORDER BY j.created_at DESC LIMIT 10;

-- últimas notícias
SELECT titulo, fonte, length(resumo) AS tam_resumo, relevancia, fetched_at
FROM news_items ORDER BY fetched_at DESC LIMIT 10;

-- notícias sem vínculo com assunto (deve voltar vazio)
SELECT n.id, n.titulo FROM news_items n
LEFT JOIN news_keyword_matches m ON m.news_item_id = n.id
WHERE m.id IS NULL;

-- o que o indicador de saúde do painel usa
SELECT MAX(finished_at) FROM search_jobs WHERE status = 'concluido';
```

### 11.4 Teste de integração completo

1. `MODO_APRESENTACAO = false` (§5.7) e interface reiniciada.
2. Crie um assunto novo em `/configuracoes`.
3. Com a VPN e os agentes ligados, espere um ciclo e acompanhe o log.
4. Rode as consultas da §11.3.
5. Recarregue `/`: indicador **verde**, notícias com fonte e resumo, chip do
   assunto no card, fatia no gráfico de pizza, barra de hoje no gráfico por dia.
6. Descarte uma notícia, force uma nova busca do mesmo assunto (§9) e confira
   que ela **não volta** ao feed.

---

## 12. Solução de problemas

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| `Cannot connect to the Docker daemon` | Docker Desktop fechado | Abra o app Docker Desktop e espere o ícone ficar estável. |
| `port is already allocated` ao subir o banco | Porta 5434 ocupada | Mude a porta da esquerda em `docker-compose.yml` e o `DATABASE_URL` dos dois `.env`. |
| Banco "vazio" depois de mudar de pasta | Compose usou outro nome de projeto e criou volume novo | Mantenha `name: pfc_web` no compose; confira com `docker volume ls` que o volume é `pfc_web_db_data`. |
| Agentes: `connection to server at "localhost", port 5434 failed: Connection refused` | Banco desligado | `cd web && docker compose up -d`. |
| Agentes: `KeyError: 'DATABASE_URL'` (ou `BUSCADOR_LLM_BASE_URL`, `RESUMIDOR_LLM_BASE_URL`) | `.env` ausente ou incompleto | `cp .env.example .env` em `agentes/` e preencha. |
| Agentes: `relation "keywords" does not exist` | Migrations não aplicadas | `cd web && npx prisma migrate deploy`. |
| Jobs em erro com `Connection error`, `timed out` ou `Connection refused` ao chamar o LLM | VPN desligada ou VM/vLLM fora do ar | Conecte a VPN; teste com o `curl` da §7.4; `ping 192.168.91.172`. Se a rota de rede não passa pela VPN (`route -n get 192.168.91.172` mostra o gateway do Wi-Fi), a VPN não está ativa. |
| Erro `401` / `Unauthorized` do LLM | `LLM_API_KEY` diferente do `--api-key` do servidor | Ajuste a chave no `agentes/.env`. |
| Erro `404` / modelo não encontrado | `*_LLM_MODEL` diferente do nome servido | Veja os nomes com `curl <url>/v1/models`. |
| Resposta do LLM vazia | Modo raciocínio do Qwen3 ligado no servidor | O cliente já envia `enable_thinking: false`; confira se o modelo/servidor foi trocado. |
| `Executable doesn't exist ... chromium` | Navegador do Playwright não instalado | `uv run playwright install chromium` (Linux: `--with-deps`). |
| Job em erro "Nenhuma noticia encontrada" | Assunto sem resultados nos últimos N dias nas fontes permitidas | Use termos mais amplos, adicione termos relacionados, aumente `BUSCADOR_MAX_IDADE_DIAS` ou adicione fontes. |
| Job em erro "Todos os N candidato(s) falharam" | Sites bloquearam a extração ou o LLM falhou em todos | Veja no log o motivo de cada artigo. |
| Job em erro "Job expirou apos 30 min em 'rodando'" | O processo dos agentes foi interrompido no meio | Normal após `Ctrl+C`/queda. Nada a fazer. |
| Painel vermelho com os agentes funcionando | Modo de apresentação desligado e nenhum job concluído nas últimas 24 h | Confira os jobs (§11.3). |
| Painel mostra notícias que não estão no banco | `MODO_APRESENTACAO = true` | §5.7. |
| Notícia no feed sem chip de assunto e fora do gráfico | Faltou a linha em `news_keyword_matches` | Rode a consulta de órfãs da §11.3. |
| `Cannot find module '@/generated/prisma/client'` | Cliente Prisma não gerado | `npm install` (ou `npx prisma generate`) em `web/`. |
| Aviso do `uv`: `VIRTUAL_ENV=... does not match the project environment` | Há outro ambiente Python ativado no terminal | Rode `deactivate` ou abra um terminal novo. O `uv` usa `agentes/.venv` de qualquer jeito. |

---

## 13. Regras que não podem ser quebradas

Estas regras protegem o contrato entre as duas metades do sistema. Detalhes em
[`web/docs/CONTRATO.md`](web/docs/CONTRATO.md).

1. Interface e agentes se comunicam **só pelo banco**. Nenhum endpoint entre eles.
2. Os agentes **nunca escrevem** em `keywords`, `app_settings` ou
   `news_items.descartada`.
3. Os agentes **nunca rodam migration** nem `CREATE`/`ALTER TABLE`. O schema é
   da interface (Prisma).
4. Só os agentes mudam `search_jobs.status`, sempre `pendente → rodando →
   concluido | erro`, preenchendo `finished_at` **também no erro**.
5. Notícia nova: `INSERT ... ON CONFLICT (url) DO NOTHING`, **nunca** `DO UPDATE`.
6. Toda notícia gravada precisa do vínculo em `news_keyword_matches`.
7. O banco tem a coleta real: **não rode o seed** (§5.6) nem apague tabelas nele.

---

## 14. Checklist final

- [ ] Git, Docker Desktop, Node 20+, npm e uv instalados
- [ ] Repositório clonado
- [ ] `web/.env` criado a partir de `web/env.example`
- [ ] `docker compose up -d` rodando (`docker compose ps` → Up)
- [ ] `npm install` e `npx prisma migrate deploy` em `web/` sem erro
- [ ] `npm run dev` e <http://localhost:3000> abrindo
- [ ] `MODO_APRESENTACAO` no valor desejado (`false` para dados reais)
- [ ] `agentes/.env` criado e preenchido (banco, URLs dos LLMs, chave)
- [ ] `uv sync` e `uv run playwright install chromium` em `agentes/`
- [ ] VPN conectada e `curl .../v1/models` respondendo nas portas 8000 e 8003
- [ ] `uv run main.py` rodando sem erro
- [ ] Assunto ativo cadastrado e primeiro job `concluido` no banco
