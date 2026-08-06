import Link from "next/link";

type Keyword = { id: string; termo: string };

export function NewsFilters({
  keywords,
  currentKeywordId,
  currentDateFrom,
  currentDateTo,
  currentSearch,
}: {
  keywords: Keyword[];
  currentKeywordId?: string;
  currentDateFrom?: string;
  currentDateTo?: string;
  currentSearch?: string;
}) {
  return (
    <form
      method="get"
      className="flex flex-wrap items-end gap-4 border border-khaki/10 bg-panel p-4"
    >
      <div className="flex min-w-[200px] flex-1 flex-col gap-1 sm:max-w-xs">
        <label htmlFor="q" className="text-xs font-medium text-sage">
          Buscar no título ou resumo
        </label>
        <input
          id="q"
          type="search"
          name="q"
          defaultValue={currentSearch ?? ""}
          placeholder="ex: sanções, fronteira…"
          className="border border-khaki/15 bg-panel-raised px-3 py-1.5 text-sm text-khaki placeholder:text-sage/50 transition-colors focus:border-brass/60"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="keywordId"
          className="text-xs font-medium text-sage"
        >
          Assunto
        </label>
        <select
          id="keywordId"
          name="keywordId"
          defaultValue={currentKeywordId ?? ""}
          className="border border-khaki/15 bg-panel-raised px-3 py-1.5 text-sm text-khaki transition-colors focus:border-brass/60"
        >
          <option value="">Todas</option>
          {keywords.map((keyword) => (
            <option key={keyword.id} value={keyword.id}>
              {keyword.termo}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="dateFrom"
          className="text-xs font-medium text-sage"
        >
          De
        </label>
        <input
          id="dateFrom"
          type="date"
          name="dateFrom"
          defaultValue={currentDateFrom ?? ""}
          className="border border-khaki/15 bg-panel-raised px-3 py-1.5 font-mono text-sm text-khaki transition-colors focus:border-brass/60"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="dateTo"
          className="text-xs font-medium text-sage"
        >
          Até
        </label>
        <input
          id="dateTo"
          type="date"
          name="dateTo"
          defaultValue={currentDateTo ?? ""}
          className="border border-khaki/15 bg-panel-raised px-3 py-1.5 font-mono text-sm text-khaki transition-colors focus:border-brass/60"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          className="border border-brass bg-brass px-4 py-1.5 text-sm font-semibold text-command transition-colors hover:border-brass-bright hover:bg-brass-bright"
        >
          Filtrar
        </button>
        {(currentKeywordId || currentDateFrom || currentDateTo || currentSearch) && (
          <Link
            href="/"
            className="border border-khaki/20 px-4 py-1.5 text-sm font-medium text-sage transition-colors hover:border-khaki/40 hover:bg-khaki/5 hover:text-khaki"
          >
            Limpar
          </Link>
        )}
      </div>
    </form>
  );
}
