import { discardNewsItem } from "@/lib/db/actions";
import { DiscardButton } from "@/components/features/news-feed/discard-button";
import { formatDateTime } from "@/lib/utils/format";

export type NewsCardItem = {
  id: string;
  titulo: string;
  url: string;
  fonte: string | null;
  resumo: string;
  fetchedAt: Date;
  matches: { keyword: { id: string; termo: string } }[];
};

export function NewsCard({ item }: { item: NewsCardItem }) {
  const discardWithId = discardNewsItem.bind(null, item.id);

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
        <form action={discardWithId}>
          <DiscardButton />
        </form>
      </div>

      <p className="text-sm leading-relaxed text-khaki/90">{item.resumo}</p>

      {item.matches.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {item.matches.map(({ keyword }) => (
            <span
              key={keyword.id}
              className="rounded-sm border border-brass/25 bg-brass/10 px-2 py-0.5 text-xs text-brass"
            >
              {keyword.termo}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
