import Link from "next/link";

type Keyword = { id: string; termo: string };

export function NewsFilters({
  keywords,
  currentKeywordId,
  currentDateFrom,
  currentDateTo,
}: {
  keywords: Keyword[];
  currentKeywordId?: string;
  currentDateFrom?: string;
  currentDateTo?: string;
}) {
  return (
    <form
      method="get"
      className="flex flex-wrap items-end gap-4 rounded-lg border border-ink/10 bg-surface p-4"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="keywordId" className="text-xs font-medium text-steel">
          Palavra-chave
        </label>
        <select
          id="keywordId"
          name="keywordId"
          defaultValue={currentKeywordId ?? ""}
          className="rounded-md border border-ink/15 bg-surface px-3 py-1.5 text-sm text-ink"
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
        <label htmlFor="dateFrom" className="text-xs font-medium text-steel">
          De
        </label>
        <input
          id="dateFrom"
          type="date"
          name="dateFrom"
          defaultValue={currentDateFrom ?? ""}
          className="rounded-md border border-ink/15 bg-surface px-3 py-1.5 text-sm text-ink"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="dateTo" className="text-xs font-medium text-steel">
          Até
        </label>
        <input
          id="dateTo"
          type="date"
          name="dateTo"
          defaultValue={currentDateTo ?? ""}
          className="rounded-md border border-ink/15 bg-surface px-3 py-1.5 text-sm text-ink"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded-md bg-navy px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-navy-deep"
        >
          Filtrar
        </button>
        {(currentKeywordId || currentDateFrom || currentDateTo) && (
          <Link
            href="/"
            className="rounded-md border border-ink/15 px-4 py-1.5 text-sm font-medium text-steel transition-colors hover:bg-ink/5 hover:text-ink"
          >
            Limpar
          </Link>
        )}
      </div>
    </form>
  );
}
