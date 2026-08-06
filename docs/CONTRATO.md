# Contrato Técnico — Sistema de Notícias para Apoio à Decisão

## Contexto

Sistema local (sem dependência de internet/nuvem para os dados sensíveis) que:
1. Busca notícias na web a partir de palavras-chave configuráveis.
2. Resume as notícias relevantes usando LLM local.
3. Exibe título, URL e resumo numa interface web para consulta da autoridade.

**Arquitetura:** duas camadas totalmente desacopladas, comunicando-se **exclusivamente através do banco de dados**. Nenhuma das camadas chama a outra diretamente (sem API HTTP entre elas, sem chamada síncrona).

```
[Interface Web (Next.js)]  <---->  [PostgreSQL]  <---->  [Agentes de IA (busca + resumo)]
        (lê e escreve                                          (lê e escreve
         keywords/config,                                       keywords, escreve
         lê notícias)                                            jobs e notícias)
```

Essa separação garante que a interface continue funcionando (mostrando o último estado conhecido) mesmo se os agentes estiverem parados, indisponíveis, ou ainda em desenvolvimento.

---

## Divisão de responsabilidades

| Camada | Responsável | Lê | Escreve |
|---|---|---|---|
| Interface web (Next.js) | Você | `keywords`, `search_jobs`, `news_items`, `news_keyword_matches` | `keywords`, `app_settings`, opcionalmente cria `search_jobs` manuais |
| Agentes de IA (busca + resumo) | Colega | `keywords` (apenas ativas) | `search_jobs`, `news_items`, `news_keyword_matches` |

Nenhum dos dois lados chama função/endpoint do outro. A comunicação é 100% via estado no banco.

---

## Modelagem do banco de dados

### `keywords`
Palavras-chave configuradas pela interface, usadas pelos agentes para saber o que buscar.

| coluna | tipo | obrigatório | observação |
|---|---|---|---|
| id | uuid/serial | sim | PK |
| termo | text | sim | nome do assunto a buscar |
| ativo | boolean | sim | agente só considera `ativo = true` |
| intervalo_minutos | int | sim | frequência de rebusca |
| termos_relacionados | text[] | sim (default `'{}'`) | termos auxiliares do assunto (ex: "drone", "OTAN") — agente usa para buscar/ranquear e preencher `relevancia`; vazio = comportamento original (adição acordada, aditiva) |
| created_at | timestamp | sim | |

### `search_jobs`
Cada execução de busca vira um registro. É o mecanismo de rastreabilidade e de indicação de "saúde do sistema".

| coluna | tipo | obrigatório | observação |
|---|---|---|---|
| id | uuid/serial | sim | PK |
| keyword_id | FK → keywords | sim | |
| status | enum | sim | `pendente`, `rodando`, `concluido`, `erro` |
| origem | enum | sim | `agendado`, `manual` |
| started_at | timestamp | não | preenchido pelo agente |
| finished_at | timestamp | não | preenchido pelo agente |
| erro_msg | text | não | preenchido só se status = `erro` |
| created_at | timestamp | sim | |

### `news_items`
Notícias já coletadas e resumidas. **Única por `url`** — não há duplicata física de notícia.

| coluna | tipo | obrigatório | observação |
|---|---|---|---|
| id | uuid/serial | sim | PK |
| titulo | text | sim | |
| url | text | sim | **UNIQUE** |
| fonte | text | não | domínio/veículo |
| resumo | text | sim | gerado pelo agente resumidor |
| relevancia | float | não | score, se o agente calcular |
| data_publicacao_original | timestamp | não | data da notícia em si |
| fetched_at | timestamp | sim | primeira vez que foi coletada |

### `news_keyword_matches` (associativa — resolve o relacionamento N:N)

**Por que essa tabela existe:** uma notícia pode satisfazer várias keywords (ex: a mesma matéria aparece numa busca por "Marinha" e também por "Forças Armadas"), e uma keyword gera várias notícias. Se guardássemos um `keyword_id` direto dentro de `news_items`, cada notícia só poderia pertencer a **uma** keyword — para representar o segundo caso, o agente seria obrigado a duplicar a notícia inteira (mesmo título, URL, resumo) uma vez por keyword. Isso geraria notícia repetida na tela, reprocessamento desnecessário do resumo, e dificultaria a checagem de duplicata pela `url` (que precisa ser única).

A tabela `news_keyword_matches` resolve isso guardando **o vínculo em si**: cada linha representa "essa notícia bateu com essa keyword, através desse job", sem duplicar a notícia. A notícia existe uma única vez em `news_items`; a keyword existe uma única vez em `keywords`; e cada "encontro" entre as duas é uma linha aqui. É a forma padrão de modelar relacionamentos N:N em banco relacional — não é uma entidade de negócio nova, é a estrutura técnica necessária para representar a relação corretamente.

| coluna | tipo | obrigatório | observação |
|---|---|---|---|
| id | uuid/serial | sim | PK |
| news_item_id | FK → news_items | sim | |
| keyword_id | FK → keywords | sim | |
| job_id | FK → search_jobs | sim | rastreia de qual execução veio o vínculo |
| created_at | timestamp | sim | |

---

## Regras de negócio (protocolo entre as camadas)

1. **O agente nunca escreve em `keywords`** — apenas lê `WHERE ativo = true`. Quem cria/ativa/desativa keywords é sempre a interface.
2. **O agente é o único que transiciona `search_jobs.status`**: `pendente` → `rodando` → `concluido` ou `erro`.
3. **Antes de inserir uma notícia, checar se `url` já existe** em `news_items`:
   - Se não existir: inserir a notícia, depois inserir o vínculo em `news_keyword_matches`.
   - Se já existir: **não duplicar** — apenas inserir o vínculo em `news_keyword_matches` associando a notícia existente à keyword/job atual.
   - Em Postgres, isso pode ser feito com `INSERT ... ON CONFLICT (url) DO NOTHING` seguido de `SELECT id ...` para recuperar o `news_item_id`.
4. **A interface nunca faz chamada síncrona ao agente.** Ela apenas lê o estado atual das tabelas a qualquer momento — inclusive se os agentes estiverem parados.
5. **Busca manual (opcional, se der tempo):** a interface pode inserir um `search_job` com `origem = manual` e `status = pendente`; o agente, ao fazer polling, prioriza esses jobs.

---

## Como cada lado consome o contrato

**Agente (colega), no loop de polling:**
```sql
-- 1. Buscar keywords ativas
SELECT * FROM keywords WHERE ativo = true;

-- 2. Ao iniciar uma busca, criar/atualizar o job
UPDATE search_jobs SET status = 'rodando', started_at = now() WHERE id = :job_id;

-- 3. Ao encontrar notícia, checar duplicata e inserir
INSERT INTO news_items (titulo, url, resumo, ...) 
VALUES (...) ON CONFLICT (url) DO NOTHING;

INSERT INTO news_keyword_matches (news_item_id, keyword_id, job_id) VALUES (...);

-- 4. Ao finalizar
UPDATE search_jobs SET status = 'concluido', finished_at = now() WHERE id = :job_id;
```

**Interface (Next.js), exemplos de leitura:**
```sql
-- Últimas notícias de uma keyword
SELECT n.* FROM news_items n
JOIN news_keyword_matches nk ON nk.news_item_id = n.id
WHERE nk.keyword_id = :keyword_id
ORDER BY n.fetched_at DESC;

-- Status geral do sistema (última execução bem-sucedida)
SELECT MAX(finished_at) FROM search_jobs WHERE status = 'concluido';
```

---

## Mock para desenvolvimento paralelo

Enquanto o agente não está pronto, popule `keywords`, `search_jobs` e `news_items`/`news_keyword_matches` manualmente com dados de exemplo, seguindo exatamente esse schema. Quando o agente real estiver funcional, nenhuma mudança será necessária do lado da interface — o contrato já é o mesmo.

---

## Fora do escopo do contrato (implementado só do lado da interface)

- Autenticação de usuário (login único/fixo via NextAuth ou similar).
- `app_settings` (parâmetros globais como limite de notícias exibidas).
- Campo `descartada` em `news_items` (curadoria manual pelo usuário final) — pode ser um `ALTER TABLE` simples adicionado depois, sem impactar o agente.

Esses itens não exigem coordenação com o agente e podem evoluir de forma independente.
