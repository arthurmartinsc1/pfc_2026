# Briefing para o lado dos agentes de IA

**Para quem é:** a pessoa responsável pelos agentes de busca e resumo, e pelo
Claude Code que trabalha naquele repositório.

**O que é:** tudo que o lado dos agentes precisa saber sobre a interface web
para que os dois lados se encaixem, mais um roteiro do manual que o repositório
dos agentes deve produzir.

**Como usar:** copie este arquivo para o repositório dos agentes e mande o
Claude Code de lá ler. A Parte 3 é literalmente o pedido a ser feito a ele.

O contrato de schema original é o [`CONTRATO.md`](CONTRATO.md) e continua
valendo em tudo. Este documento **não substitui e não altera o contrato** — ele
acrescenta o que foi descoberto depois, implementando a interface: o que ela
realmente lê de cada coluna e o que acontece na tela quando um campo vem vazio.

---

## Parte 1 — A fronteira entre os dois lados

```
[Interface Web (Next.js)]  <---->  [PostgreSQL]  <---->  [Agentes (busca + resumo)]
     lê notícias e jobs                                    lê keywords ativas
     escreve keywords e config                             escreve jobs e notícias
```

Nenhum lado chama o outro. Sem HTTP entre eles, sem fila, sem webhook. A única
superfície compartilhada é o estado nas tabelas.

Isso é decisão de arquitetura, não limitação temporária: a interface tem que
continuar mostrando o último estado conhecido com os agentes parados, e os
agentes têm que conseguir rodar com a interface desligada.

**Consequências práticas para o lado dos agentes:**

- Não construa endpoint HTTP esperando que a interface chame. Ela não vai.
- Não espere ser avisado de uma keyword nova. Descubra por polling.
- Não tente notificar a interface de que terminou. Escrever
  `search_jobs.finished_at` **é** a notificação.

### Propriedade de escrita

| Tabela | Agentes | Interface |
|---|---|---|
| `keywords` | **só leitura** | escreve (CRUD) |
| `search_jobs` | **escreve** (dono do `status`) | só leitura; pode inserir job `pendente` com `origem = 'manual'` |
| `news_items` | **escreve** (menos `descartada`) | só escreve `descartada` |
| `news_keyword_matches` | **escreve** | só leitura |
| `app_settings` | **não toca** | escreve |

Duas regras que, se furadas, estragam o trabalho do outro lado:

1. **O agente nunca escreve em `keywords`.** Nem para marcar "já busquei isso".
   Se precisar de estado de controle, crie uma tabela própria com prefixo
   (ex.: `agent_*`) e registre no `CONTRATO.md`.
2. **O agente nunca escreve em `news_items.descartada`.** Essa coluna é a
   curadoria manual do usuário final. Em particular: ao reencontrar uma URL já
   existente, **não faça `UPDATE` na linha** — veja a Parte 2.4.

### Quem cria as tabelas

A interface. O schema é versionado em migrations do Prisma e aplicado com
`npx prisma migrate deploy` (ver [`DEPLOY.md`](../DEPLOY.md)). **O lado dos
agentes não roda migration e não faz `CREATE`/`ALTER TABLE`.** Precisa de uma
coluna nova? Combine, atualize o `CONTRATO.md`, e a interface gera a migration.

---

## Parte 2 — Fatos exatos do banco

Tudo nesta seção foi extraído do DDL real das migrations, não de memória.

### 2.1 Conexão

Mesmo Postgres da interface. Em desenvolvimento, o `docker-compose.yml` expõe na
**porta 5434** do host (não 5432, para não conflitar com Postgres local):

```
postgresql://<usuario>:<senha>@<host>:5434/noticias
```

Em produção a porta e as credenciais mudam. Nunca exponha a porta do Postgres
publicamente — libere apenas o IP da máquina dos agentes.

### 2.2 Nomes exatos

Tabelas em `snake_case`: `keywords`, `search_jobs`, `news_items`,
`news_keyword_matches`, `app_settings`.

Chaves primárias são `UUID` com `DEFAULT gen_random_uuid()` — **omita o `id` no
insert** e deixe o banco gerar.

Os dois enums têm nome em PascalCase e **precisam de aspas duplas** em SQL cru:

```sql
CREATE TYPE "JobStatus" AS ENUM ('pendente', 'rodando', 'concluido', 'erro');
CREATE TYPE "JobOrigin" AS ENUM ('agendado', 'manual');
```

Os valores são minúsculos e **sem acento** — é `'concluido'`, não `'concluído'`.
Um valor fora da lista derruba o insert.

### 2.3 O que a interface lê de cada coluna

Esta é a parte que não está no contrato original. Coluna por coluna, o que
aparece na tela e o que acontece se vier vazia:

| Coluna | Onde aparece | Se vier nula/vazia |
|---|---|---|
| `news_items.titulo` | título do card, é o link clicável | obrigatório no schema |
| `news_items.url` | destino do link; **UNIQUE** | obrigatório |
| `news_items.resumo` | corpo do card | obrigatório — é o produto do resumidor |
| `news_items.fonte` | linha de cima do card ("CNN Brasil · 08/10/2026") | o card simplesmente omite o veículo; preencha |
| `news_items.fetched_at` | data exibida no card, ordenação do feed, e o **gráfico de notícias por dia** (janela de 14 dias) | obrigatório, tem default `now()` |
| `news_items.relevancia` | **nada ainda** | aceito e guardado, mas a interface ainda não exibe |
| `news_items.data_publicacao_original` | **nada ainda** | idem; o card mostra `fetched_at` |
| `news_items.descartada` | filtra o feed e todos os gráficos | **não escreva** |
| `search_jobs.status` | status por assunto na tela de configurações | o agente é o único dono |
| `search_jobs.finished_at` | **"Última atualização" no painel** | ver 2.5 — é o campo mais crítico |
| `search_jobs.started_at` | "Em execução desde …" quando `status = 'rodando'` | mostra "—" |
| `search_jobs.erro_msg` | aparece junto do status quando `status = 'erro'` | mostra só "Erro em <data>" |
| `news_keyword_matches` | chips de assunto no card, filtro por assunto, e o **gráfico de pizza** | sem linhas aqui, a notícia aparece "órfã": sem chip, fora do donut, invisível no filtro por assunto |
| `keywords.termos_relacionados` | chips secundários, quando o termo aparece no título ou resumo | lido pelo agente para buscar/ranquear |

### 2.4 Inserindo notícia sem duplicar

`news_items.url` é UNIQUE. A mesma matéria pode casar com vários assuntos, e nesse
caso a notícia existe **uma vez** e ganha **uma linha de vínculo por assunto**:

```sql
-- 1. Insere a notícia só se a URL for nova. Note o DO NOTHING:
--    nunca DO UPDATE, para não sobrescrever `descartada`.
INSERT INTO news_items (titulo, url, fonte, resumo, relevancia, data_publicacao_original)
VALUES (%s, %s, %s, %s, %s, %s)
ON CONFLICT (url) DO NOTHING;

-- 2. Recupera o id (serve tanto para a nova quanto para a que já existia)
SELECT id FROM news_items WHERE url = %s;

-- 3. Cria o vínculo notícia <-> assunto <-> job
INSERT INTO news_keyword_matches (news_item_id, keyword_id, job_id)
VALUES (%s, %s, %s)
ON CONFLICT (news_item_id, keyword_id, job_id) DO NOTHING;
```

`news_keyword_matches` tem UNIQUE em `(news_item_id, keyword_id, job_id)`, por
isso o `ON CONFLICT DO NOTHING` do passo 3 torna o reprocessamento do mesmo job
seguro de repetir.

**Sobre notícia descartada:** se o usuário descartou uma notícia e o agente
reencontra a mesma URL depois, ela continua descartada e **não volta** para o
feed. Isso é intencional — é a curadoria do usuário. Não tente "reativar".

### 2.5 O campo que controla o semáforo do painel

O painel tem um indicador de saúde que roda esta consulta:

```sql
SELECT MAX(finished_at) FROM search_jobs WHERE status = 'concluido';
```

E decide assim:

- **nenhum job na tabela** → cinza neutro, "Aguardando a primeira execução dos
  agentes" (estado de sistema novo, não é alarme)
- **existem jobs, mas o resultado é nulo** (nenhum concluído, ou concluídos sem
  `finished_at`) → **vermelho**, "Nenhuma busca concluída até o momento"
- resultado com **mais de 24 horas** → **vermelho**, "sem novas buscas há mais
  de 24h"
- resultado **recente** → **verde**, "Última atualização: <data e hora>"

Ou seja: **concluir um job sem preencher `finished_at` deixa o painel vermelho
para sempre**, mesmo com tudo funcionando. O ciclo completo é:

```sql
-- início
UPDATE search_jobs SET status = 'rodando', started_at = now() WHERE id = %s;
-- sucesso
UPDATE search_jobs SET status = 'concluido', finished_at = now() WHERE id = %s;
-- falha
UPDATE search_jobs SET status = 'erro', finished_at = now(), erro_msg = %s WHERE id = %s;
```

Preencha `finished_at` também no caso de erro — é o que dá a data mostrada em
"Erro em <data>" na tela de configurações.

### 2.6 Quem agenda

O agente. A interface só cadastra a keyword com seu `intervalo_minutos`; criar o
`search_job` é do lado dos agentes:

- jobs de rotina entram com `origem = 'agendado'`, respeitando o
  `intervalo_minutos` de cada keyword ativa;
- a interface **pode** inserir um job `pendente` com `origem = 'manual'` (busca
  sob demanda); o agente, no polling, deve priorizar esses.

Loop mínimo:

```sql
-- 1. assuntos a monitorar (só os ativos!)
SELECT id, termo, termos_relacionados, intervalo_minutos
FROM keywords WHERE ativo = true;

-- 2. jobs manuais pendentes têm prioridade
SELECT id, keyword_id FROM search_jobs
WHERE status = 'pendente' ORDER BY (origem = 'manual') DESC, created_at ASC;
```

---

## Parte 3 — O pedido ao Claude Code do repositório dos agentes

A partir daqui é o texto a ser entregue ao Claude Code do outro repositório.
Pode copiar o bloco inteiro como prompt.

> Leia `BRIEFING-AGENTES.md` (este arquivo) e `CONTRATO.md` por completo antes
> de escrever qualquer coisa. Depois produza dois arquivos no repositório dos
> agentes: um `CLAUDE.md` na raiz e um `MANUAL.md`.
>
> **Regras de conteúdo, para os dois arquivos:**
>
> - Não invente comando, nome de arquivo, caminho, variável de ambiente ou
>   versão. Antes de documentar que algo funciona, **rode** e confirme. Se não
>   conseguir verificar, escreva explicitamente que não foi verificado.
> - Documente o que o repositório **é hoje**, não o que ele deveria ser.
> - Todo comando tem que ser copiável e funcionar numa máquina limpa.
> - Português, do mesmo jeito que este arquivo.
>
> **O `CLAUDE.md` da raiz** é o que vai dirigir você em todas as sessões
> futuras. Tem que conter, no mínimo:
>
> 1. Contexto: este repositório é a camada de agentes de IA (busca + resumo) de
>    um TCC; a interface web é de outra pessoa, em outro repositório.
> 2. A ordem de ler `CONTRATO.md` e `BRIEFING-AGENTES.md` antes de qualquer
>    mudança que toque no banco.
> 3. As regras inegociáveis, que são o espelho das do lado da interface:
>    - a comunicação com a interface é **exclusivamente pelo banco**; nunca
>      criar endpoint para a interface chamar nem chamar a interface;
>    - nunca escrever em `keywords`, `app_settings` ou
>      `news_items.descartada`;
>    - nunca rodar migration nem `CREATE`/`ALTER TABLE` — o schema é da
>      interface;
>    - sempre preencher `finished_at` ao fechar um job, inclusive em erro;
>    - sempre inserir as linhas de `news_keyword_matches` (sem elas a notícia
>      não aparece em gráfico nem em filtro nenhum);
>    - `ON CONFLICT (url) DO NOTHING`, nunca `DO UPDATE`.
>    - o banco de desenvolvimento é compartilhado e tem dados reais: nunca
>      popular com dados falsos nem truncar tabela sem autorização explícita.
> 4. A stack real (linguagem, versão, gerenciador de dependências, como os
>    modelos locais são servidos).
> 5. Como trabalhar: fases pequenas, não avançar sem confirmação, rodar os
>    testes/linter antes de parar, e dizer no chat quais arquivos mudaram e por
>    quê.
>
> **O `MANUAL.md`** é a documentação para outra pessoa reproduzir e operar os
> agentes do zero. Seções obrigatórias:
>
> 1. **O que os agentes fazem** — buscador e resumidor, em um parágrafo cada,
>    com a fronteira: o que eles nunca fazem.
> 2. **Do zero absoluto** — sistema operacional testado, versão de linguagem,
>    como instalar as dependências, quanto de RAM/VRAM/disco é necessário.
> 3. **Os modelos locais** — qual modelo cada agente usa, de onde baixa, quanto
>    ocupa, como é servido (Ollama? vLLM? transformers direto?), e como trocar
>    de modelo. Inclua o tempo aproximado de uma execução, para dar noção de
>    custo.
> 4. **Configuração** — toda variável de ambiente, com exemplo e valor padrão,
>    incluindo a `DATABASE_URL`. Diga explicitamente que o arquivo de ambiente
>    não vai para o git.
> 5. **Como rodar** — comando em primeiro plano para testar, e como manter vivo
>    em produção (systemd, cron ou supervisor), com onde ficam os logs.
> 6. **O contrato com a interface** — reproduza o ciclo de vida do job e o
>    insert sem duplicata (Partes 2.4 e 2.5 deste arquivo) com o código **real**
>    do repositório, não pseudo-código.
> 7. **Como testar sem a interface** — como forçar uma execução e qual `SELECT`
>    rodar para provar que gravou certo.
> 8. **Reprodução do Claude Code de vocês** — espelhe a estrutura de
>    `docs/CLAUDE-CODE.md` do repositório da interface: quais arquivos dirigem o
>    comportamento, o que **não** vem no `git clone` (memória e permissões) e
>    como recriar.
> 9. **Armadilhas** — tudo que já fez alguém perder uma tarde.
>
> Quando terminar, liste no chat os arquivos criados e, para cada comando
> documentado, diga se você executou ou se só transcreveu.

---

## Parte 4 — Testando a integração junta

Nenhum dos dois lados prova a integração sozinho. O teste conjunto é curto:

1. **Interface** cria um assunto novo em `/configuracoes` (ex.: "teste
   integracao"), com `ativo = true`.
2. **Agentes** rodam um ciclo. Devem enxergar a keyword nova sem reiniciar
   nada e sem ninguém avisar.
3. **Banco** confere o que foi gravado:

   ```sql
   SELECT status, started_at, finished_at, erro_msg FROM search_jobs
   ORDER BY created_at DESC LIMIT 5;

   SELECT n.titulo, n.fonte, length(n.resumo) AS tam_resumo, n.fetched_at
   FROM news_items n ORDER BY n.fetched_at DESC LIMIT 5;

   -- toda notícia recente tem que ter vínculo; linhas aqui = notícia órfã
   SELECT n.id, n.titulo FROM news_items n
   LEFT JOIN news_keyword_matches m ON m.news_item_id = n.id
   WHERE m.id IS NULL;
   ```

4. **Interface** recarrega `/` e confere os quatro pontos:
   - status da coleta **verde** com a hora de agora (prova que `finished_at` foi
     preenchido);
   - as notícias no feed com fonte, data e resumo;
   - chips de assunto nos cards e a fatia no gráfico de pizza (prova que os
     `news_keyword_matches` entraram);
   - a barra de hoje no gráfico por dia.
5. **Interface** descarta uma notícia; **agentes** rodam de novo sobre a mesma
   URL. A notícia tem que continuar fora do feed — prova que o `DO NOTHING` não
   está sobrescrevendo `descartada`.

Se o passo 4 mostrar coleta verde mas o donut vazio, o problema é sempre o
mesmo: faltou inserir em `news_keyword_matches`.

> **Aviso para quem for testar agora:** a interface está com o modo de
> apresentação ligado (`MODO_APRESENTACAO = true` em
> `src/lib/mock/apresentacao.ts`), exibindo notícias fictícias em vez do banco.
> **Troque para `false` antes do teste conjunto**, ou a tela não vai refletir
> nada do que os agentes gravarem.
