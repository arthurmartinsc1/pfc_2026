# Spec para o Front — "Assunto" com termos relacionados

## Objetivo
Evoluir a `keyword` para representar um **Assunto**: além do nome do tema
("Guerra na Ucrânia"), o cliente cadastra uma lista de **termos relacionados**
(drone, fuzil, míssil, OTAN…). O backend usa esses termos para **achar e ranquear**
melhor as notícias.

Decisão de schema: **coluna array** na tabela `keywords` que já existe (não é tabela
nova, não renomeia nada). Migration mínima e aditiva — `search_jobs`,
`news_keyword_matches` e todo o resto continuam iguais.

---

## 1. Migration (Prisma)

Adicionar **um campo** ao model `Keyword`:

```prisma
model Keyword {
  id                Int       @id @default(autoincrement())   // (o que já existe)
  termo             String                                    // nome do assunto
  ativo             Boolean   @default(true)
  intervaloMinutos  Int       @map("intervalo_minutos")
  createdAt         DateTime  @default(now()) @map("created_at")

  // >>> NOVO CAMPO <<<
  termosRelacionados String[] @default([]) @map("termos_relacionados")
}
```

> Ajuste os campos existentes conforme o schema real de vocês — o único acréscimo é
> `termosRelacionados`.

SQL equivalente que o Prisma vai gerar (só pra referência):

```sql
ALTER TABLE "keywords"
  ADD COLUMN "termos_relacionados" TEXT[] NOT NULL DEFAULT '{}';
```

Pontos importantes:
- **`NOT NULL DEFAULT '{}'`** → keywords antigas ficam com array vazio automaticamente,
  sem quebrar nada. Array vazio = backend se comporta como hoje (busca só pelo nome).
- É **aditivo**: nenhuma coluna/tabela existente muda.

---

## 2. UI (página de cadastro/edição de Assunto)

No formulário que hoje tem **nome do assunto** (`termo`), **ativo**, **intervalo**,
adicionar um campo de **termos relacionados** — ideal um input de *chips/tags*
(digita, aperta enter, vira uma tag; pode remover). Salvar no campo
`termosRelacionados`.

Sugestões de UX:
- Placeholder tipo "drone, fuzil, míssil, OTAN…".
- Sem limite rígido, mas ~3 a 10 termos é o ponto ideal (poucos = filtro fraco,
  muitos = ruído).
- Campo **opcional** — se vazio, funciona como hoje.

Nada mais muda no front: jobs, feed de notícias e vínculos continuam usando
`keyword_id` exatamente igual.

---

## 3. Exemplo de registro

```json
{
  "id": 1,
  "termo": "Guerra na Ucrânia",
  "ativo": true,
  "intervaloMinutos": 60,
  "termosRelacionados": ["drone", "fuzil", "míssil", "OTAN", "Zelensky"]
}
```

---

## 4. O que o backend (agentes) faz com isso

Permissão inalterada: o backend **só lê** `keywords` (nunca escreve). Com os termos
relacionados, ele passa a:

1. **Buscar** pelo nome do assunto e, opcionalmente, combinações com os termos.
2. **Ranquear** os candidatos pela presença dos termos no título/resumo — isso passa a
   **preencher o campo `relevancia`** de `news_items` (hoje sempre `NULL`), permitindo
   ordenar/filtrar o feed por relevância.
3. **Dar contexto ao LLM seletor** ("assunto: … ; termos relacionados: …") para
   escolher as melhores notícias com mais precisão.

Se `termosRelacionados` estiver vazio, o comportamento é o atual.

---

## 5. Sequência combinada

1. **Front aplica a migration** (adiciona `termos_relacionados`) e sobe a UI de tags.
2. **Backend liga o uso** dos termos (busca + ranqueamento + relevância). *Só depois
   da migration* — antes disso o backend continua no modelo atual.

> Assim que a migration estiver aplicada, é só avisar que o backend passa a consumir o
> campo. Nenhuma coordenação em tempo real é necessária — tudo via banco, como sempre.
