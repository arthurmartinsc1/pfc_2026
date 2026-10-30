# Como o Claude Code funciona neste projeto

Documento de reprodução: explica **o que faz o Claude Code se comportar do jeito
que ele se comporta neste repositório** e como chegar do zero absoluto — máquina
limpa, ninguém instalado — até uma sessão funcionando igual à original.

Não há mágica e não há estado escondido num servidor. O comportamento vem de
**arquivos de texto em lugares previsíveis**. Se você copiar os arquivos certos,
você reproduz o comportamento. O resto deste documento é a lista desses
arquivos e a ordem para montá-los.

---

## 1. O modelo mental em um parágrafo

O Claude Code é um programa de linha de comando. Quando você roda `claude`
dentro de uma pasta, ele lê um conjunto de arquivos de instrução daquela pasta
(e da sua pasta de usuário), junta tudo num prompt, e passa a conversar com você
tendo acesso a ferramentas: ler arquivo, escrever arquivo, rodar comando no
terminal. Ele **não** tem memória automática do que aconteceu em sessões
anteriores — exceto o que foi gravado em arquivos de memória. Então "clonar" o
Claude Code deste projeto = reproduzir (a) o programa, (b) os arquivos de
instrução, (c) os arquivos de memória.

---

## 2. O que realmente dirige o comportamento

Cinco fontes, da mais importante para a menos:

| # | Arquivo | Vem no `git clone`? | O que faz |
|---|---|---|---|
| 1 | `CLAUDE.md` (raiz) | **Sim** | Instruções do projeto, injetadas automaticamente no início de toda sessão. É o documento mais importante. |
| 2 | `docs/CONTRATO.md` | **Sim** | O contrato de banco com a equipe dos agentes. O `CLAUDE.md` manda ler antes de qualquer mudança de schema. |
| 3 | `docs/PLANO.md` | **Sim** | O plano em fases. O `CLAUDE.md` manda não avançar de fase sem aprovação. |
| 4 | `~/.claude/projects/<slug>/memory/` | **NÃO** | Memória de longo prazo (lições de sessões passadas). Fica na sua pasta de usuário, **fora do repositório**. |
| 5 | `.claude/settings.local.json` | **NÃO** | Permissões pré-aprovadas de comandos. Também fora do controle de versão. |

As duas linhas com **NÃO** são a parte que as pessoas erram. Um `git clone`
entrega o repositório, mas entrega um Claude Code **sem memória e sem
permissões**. A seção 5 explica como recriar as duas.

### 2.1 O que o `CLAUDE.md` deste projeto determina

Vale ler o arquivo inteiro (são 30 linhas), mas o resumo do que ele impõe:

- **Stack travada**: Next.js (App Router) + TypeScript, Prisma, PostgreSQL via
  Docker, Tailwind. Sem serviços de nuvem.
- **Regra inegociável nº 1**: a interface fala com os agentes **só pelo banco**.
  Nunca criar endpoint para o agente chamar, nunca chamar API de busca/LLM
  do Next.js.
- **Regra inegociável nº 2**: respeitar a tabela de propriedade de escrita do
  `CONTRATO.md`. A interface nunca escreve em `news_items.resumo` nem em
  `search_jobs.status`.
- **Regra inegociável nº 3**: a aplicação funciona mesmo com o banco vazio
  (estados vazios tratados).
- **Modo de trabalho**: fases pequenas, não avançar sem confirmação, rodar
  lint/build antes de parar, e dizer no chat quais arquivos mudaram e por quê.

### 2.2 O que está na memória hoje

Dois arquivos, em `~/.claude/projects/-Users-tutumartinss-Projects-PFC-WEB/memory/`:

- **`no-fake-data-in-db.md`** — nunca inserir dados falsos no Postgres nem rodar
  `prisma db seed` sem pedir. Origem: em 2026-08-12 o seed foi rodado para
  "encher o gráfico" e destruiu notícias reais coletadas pelo agente. Mock é
  permitido **só na camada de exibição**.
- **`toast-pattern.md`** — toda confirmação de ação do usuário usa o
  `useToast()` global de `src/components/ui/toast.tsx`, não mensagem inline.

Essas duas lições não estão no código nem no histórico do git. Se você clonar o
repositório sem recriá-las, o Claude Code vai eventualmente repetir o erro do
seed. **É o item mais importante desta página.**

---

## 3. Do zero absoluto

### 3.1 Instalar o que o Claude Code precisa

```bash
# Node.js 20 ou superior (aqui está rodando v24)
# macOS com Homebrew:
brew install node
# Ubuntu, via nvm (evita conflito com o node do sistema):
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc && nvm install 20
```

### 3.2 Instalar e autenticar o Claude Code

```bash
npm install -g @anthropic-ai/claude-code
claude --version     # a sessão original rodou 2.1.304
```

Na primeira execução ele pede login (navegador, conta Anthropic). Autenticação
é por conta — não existe arquivo de credencial para copiar, e **nunca** copie
chave de API para dentro do repositório.

### 3.3 Clonar o projeto

```bash
git clone https://github.com/Petralanda/language-agents-for-cyberspace-situational-awareness.git
cd language-agents-for-cyberspace-situational-awareness
```

### 3.4 Pôr o projeto de pé

O passo a passo completo está no [`README.md`](../README.md); o essencial:

```bash
cp env.example .env     # .env NÃO vem no clone (está no .gitignore)
docker compose up -d    # Postgres na porta 5434 do host, não 5432
npm install             # o postinstall roda `prisma generate`
npx prisma migrate deploy
npm run dev             # http://localhost:3000
```

Três coisas que travam quem faz isso pela primeira vez:

1. **`.env` não vem no clone.** Sem ele, o Prisma não acha o banco. Copie do
   `env.example`.
2. **A porta é 5434**, não a 5432 padrão, para não brigar com um Postgres já
   instalado na máquina. Se a 5434 também estiver ocupada, mude em
   `docker-compose.yml` **e** no `.env`.
3. **O Docker precisa estar rodando.** Com o daemon parado, qualquer página dá
   erro 500 de conexão, o que parece bug da aplicação e não é.

### 3.5 Abrir a sessão

```bash
claude
```

Rodando de dentro da pasta do projeto, ele já carrega o `CLAUDE.md`
automaticamente. Você pode confirmar pedindo: *"quais instruções de projeto você
carregou?"*.

---

## 4. Configuração de modelo usada aqui

Em `~/.claude/settings.json` (pasta de usuário, não no repo):

```json
{
  "model": "opus",
  "effortLevel": "high",
  "alwaysThinkingEnabled": true,
  "enabledPlugins": {
    "frontend-design@claude-plugins-official": true,
    "clangd-lsp@claude-plugins-official": true
  }
}
```

Em linguagem comum: modelo Opus (o mais capaz), esforço de raciocínio alto, e
raciocínio sempre ligado. Dá para mudar pelo comando `/config` dentro da
sessão, ou `/model` só para o modelo. O `frontend-design` é o plugin que
sustenta as decisões visuais do painel.

Isso **não** é obrigatório para o projeto funcionar — é a configuração que
produziu o resultado atual. Com um modelo mais leve o código sai, mas as
escolhas de design e as verificações tendem a ser mais rasas.

---

## 5. Recriando o que o `git clone` não traz

### 5.1 A memória

O caminho da pasta de memória depende do caminho do projeto na sua máquina: o
Claude Code transforma o caminho absoluto num nome de pasta, trocando `/` e `_`
por `-`. Aqui, `/Users/tutumartinss/Projects/PFC_WEB` virou
`-Users-tutumartinss-Projects-PFC-WEB`. Em outra máquina o nome muda. Para
descobrir o seu, peça na sessão: *"qual é o caminho da sua pasta de memória
neste projeto?"*.

Dentro dela, crie `MEMORY.md` (o índice, carregado toda sessão):

```markdown
# MEMORY

- [Toast pattern](toast-pattern.md) — usar useToast() global em toda confirmação de interação do usuário
- [No fake data in DB](no-fake-data-in-db.md) — nunca escrever mock no banco (compartilhado com o agente); mock só na camada de exibição
```

E um arquivo por lição. O formato é frontmatter + corpo:

```markdown
---
name: no-fake-data-in-db
description: Nunca escrever dados mockados no banco compartilhado com o agente — mock só na camada de exibição
metadata:
  type: feedback
---

Nunca inserir dados falsos (notícias, jobs, matches) no Postgres, nem rodar
`prisma db seed` sem pedir — o seed apaga tudo (`deleteMany`) e o banco é
compartilhado com o agente de IA, que grava dados reais nele.

**Why:** Em 2026-08-12 o seed foi rodado para "encher o gráfico" e destruiu
notícias reais coletadas pelo agente.

**How to apply:** Quando pedirem dados "bonitos" para gráficos ou demo, fazer o
preenchimento só na camada de exibição (ver `src/lib/mock/apresentacao.ts`). O
banco fica intocado.
```

O jeito mais simples de não errar o formato: peça na sessão *"grave na memória
que ..."* e deixe o Claude Code escrever o arquivo.

### 5.2 As permissões

Sem `.claude/settings.local.json`, o Claude Code vai pedir confirmação a cada
comando. Para reproduzir o conjunto pré-aprovado daqui, crie o arquivo com:

```json
{
  "permissions": {
    "allow": [
      "Bash(npm run *)",
      "Bash(npx prisma *)",
      "Bash(docker compose *)",
      "Bash(node *)",
      "Bash(git checkout *)"
    ]
  }
}
```

Autorize só o que você entende. Essa lista é conveniência, não requisito — com o
arquivo ausente, tudo funciona, só com mais cliques.

---

## 6. Como saber se o clone ficou fiel

Checklist de verificação. Os quatro primeiros itens são objetivos; os dois
últimos testam se as instruções pegaram.

- [ ] `claude --version` responde
- [ ] `docker compose ps` mostra o Postgres de pé
- [ ] `npm run build` termina sem erro
- [ ] `http://localhost:3000` abre o feed (mesmo vazio, sem quebrar)
- [ ] Pergunte: *"posso rodar prisma db seed para encher o gráfico?"* — a
      resposta tem que ser **não**, citando o banco compartilhado. Se ele
      topar, a memória não foi recriada (volte para a 5.1).
- [ ] Pergunte: *"crie um endpoint para o agente avisar que terminou"* — a
      resposta tem que recusar e apontar a regra do `CLAUDE.md`. Se ele criar,
      o `CLAUDE.md` não está sendo carregado (você não está rodando de dentro
      da pasta do projeto).

---

## 7. Armadilhas conhecidas

- **Modo de apresentação ligado.** `src/lib/mock/apresentacao.ts` tem a
  constante `MODO_APRESENTACAO`. Com ela em `true`, o painel exibe 18 notícias
  fictícias e uma coleta "de hoje", ignorando o banco. Foi feito para gravar a
  apresentação com a VM dos agentes fora do ar. **Antes de subir para a VM,
  troque para `false`**, ou os dados reais do agente ficam invisíveis. Nada
  disso é escrito no banco.
- **Memória não versionada.** Toda máquina nova começa sem memória. Trocar de
  computador = refazer a seção 5.1.
- **O banco não é descartável.** O Postgres do `docker-compose.yml` é o
  ambiente real do TCC: o agente da dupla escreve notícias reais nele. Não é
  base de teste. Nunca rode `prisma db seed` sem decidir isso de propósito.
- **`AGENTS.md` na raiz** é um arquivo de avisos do tooling do Next.js (manda
  consultar `node_modules/next/dist/docs/` antes de assumir APIs). Não
  confundir com os agentes de IA do TCC — não tem relação.
- **Deploy** tem documento próprio: [`DEPLOY.md`](../DEPLOY.md).

---

## 8. Para o outro lado do projeto

O repositório dos agentes de IA (busca + resumo) é de outra pessoa e tem o
próprio Claude Code. Para que os dois lados se encaixem, existe um briefing
pronto para ser entregue a ela:
[`docs/BRIEFING-AGENTES.md`](BRIEFING-AGENTES.md).
