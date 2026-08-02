import { discardNewsItem } from "@/lib/actions";
import { DiscardButton } from "@/components/discard-button";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

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
    <article className="flex flex-col gap-3 rounded-lg border border-slate-200 border-l-4 border-l-indigo-500 bg-white p-4 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-l-indigo-600 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
            {item.fonte && <span>{item.fonte}</span>}
            {item.fonte && <span>·</span>}
            <span>{dateFormatter.format(item.fetchedAt)}</span>
          </div>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[15px] font-semibold leading-snug text-slate-900 hover:text-indigo-600 hover:underline"
          >
            {item.titulo}
          </a>
        </div>
        <form action={discardWithId}>
          <DiscardButton />
        </form>
      </div>

      <p className="text-sm text-slate-600">{item.resumo}</p>

      {item.matches.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {item.matches.map(({ keyword }) => (
            <span
              key={keyword.id}
              className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700"
            >
              {keyword.termo}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
