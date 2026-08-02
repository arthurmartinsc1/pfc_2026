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
      className="flex flex-wrap items-end gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="keywordId" className="text-xs font-medium text-slate-500">
          Palavra-chave
        </label>
        <select
          id="keywordId"
          name="keywordId"
          defaultValue={currentKeywordId ?? ""}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
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
        <label htmlFor="dateFrom" className="text-xs font-medium text-slate-500">
          De
        </label>
        <input
          id="dateFrom"
          type="date"
          name="dateFrom"
          defaultValue={currentDateFrom ?? ""}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="dateTo" className="text-xs font-medium text-slate-500">
          Até
        </label>
        <input
          id="dateTo"
          type="date"
          name="dateTo"
          defaultValue={currentDateTo ?? ""}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Filtrar
        </button>
        {(currentKeywordId || currentDateFrom || currentDateTo) && (
          <Link
            href="/"
            className="rounded-md border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Limpar
          </Link>
        )}
      </div>
    </form>
  );
}
