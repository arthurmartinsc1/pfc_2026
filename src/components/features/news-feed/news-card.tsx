import { DiscardButton } from "@/components/features/news-feed/discard-button";
import { formatDateTime } from "@/lib/utils/format";

export type NewsCardItem = {
  id: string;
  titulo: string;
  url: string;
  fonte: string | null;
  resumo: string;
  fetchedAt: Date;
  matches: {
    keyword: { id: string; termo: string; termosRelacionados: string[] };
  }[];
};

// Comparação sem acentos e sem caixa, para "míssil" casar com "Missil".
function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

// Termos relacionados (dos assuntos que casaram) que de fato aparecem no
// título ou no resumo desta notícia — mostra ao leitor *por que* a notícia
// foi considerada relevante.
function findMatchedTerms(item: NewsCardItem): string[] {
  const haystack = normalize(`${item.titulo} ${item.resumo}`);
  const found = new Set<string>();
  for (const { keyword } of item.matches) {
    for (const termo of keyword.termosRelacionados ?? []) {
      if (termo.trim() && haystack.includes(normalize(termo))) {
        found.add(termo);
      }
    }
  }
  return Array.from(found);
}

// Um mesmo assunto pode casar a mesma notícia em jobs diferentes (a unicidade
// no banco é por notícia+assunto+job) — exibe cada assunto uma vez só.
function uniqueKeywords(item: NewsCardItem) {
  const byId = new Map(item.matches.map(({ keyword }) => [keyword.id, keyword]));
  return Array.from(byId.values());
}

export function NewsCard({ item }: { item: NewsCardItem }) {
  const matchedTerms = findMatchedTerms(item);
  const keywords = uniqueKeywords(item);

  return (
    <article className="flex flex-col gap-3 border border-l-4 border-khaki/10 border-l-brass/40 bg-panel p-4 transition-colors duration-200 hover:border-l-brass hover:bg-panel-raised">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-sage">
            {item.fonte && <span>{item.fonte}</span>}
            {item.fonte && <span aria-hidden="true">·</span>}
            <span className="font-mono">{formatDateTime(item.fetchedAt)}</span>
          </div>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-display text-lg font-semibold leading-snug text-khaki transition-colors hover:text-brass-bright hover:underline"
          >
            {item.titulo}
          </a>
        </div>
        <DiscardButton newsItemId={item.id} />
      </div>

      <p className="text-sm leading-relaxed text-khaki/90">{item.resumo}</p>

      {(keywords.length > 0 || matchedTerms.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {keywords.map((keyword) => (
            <span
              key={keyword.id}
              className="rounded-sm border border-brass/25 bg-brass/10 px-2 py-0.5 text-xs text-brass"
            >
              {keyword.termo}
            </span>
          ))}
          {matchedTerms.map((termo) => (
            <span
              key={termo}
              className="rounded-sm border border-khaki/15 px-2 py-0.5 text-xs text-sage"
            >
              {termo}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
