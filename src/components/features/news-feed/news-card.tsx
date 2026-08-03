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
    <article className="flex flex-col gap-3 rounded-lg border border-l-4 border-ink/10 border-l-navy bg-surface p-4 transition-colors hover:bg-ink/[0.02]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium uppercase tracking-wide text-steel">
            {item.fonte && <span>{item.fonte}</span>}
            {item.fonte && <span>·</span>}
            <span>{formatDateTime(item.fetchedAt)}</span>
          </div>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-heading text-base font-semibold leading-snug text-ink hover:text-navy hover:underline"
          >
            {item.titulo}
          </a>
        </div>
        <form action={discardWithId}>
          <DiscardButton />
        </form>
      </div>

      <p className="text-sm text-ink/70">{item.resumo}</p>

      {item.matches.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {item.matches.map(({ keyword }) => (
            <span
              key={keyword.id}
              className="rounded-full bg-navy/8 px-2 py-0.5 text-xs text-navy"
            >
              {keyword.termo}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
