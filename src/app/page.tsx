import { HealthIndicator } from "@/components/health-indicator";
import { NewsFilters } from "@/components/news-filters";
import { NewsCard } from "@/components/news-card";
import { Pagination } from "@/components/pagination";
import { getAppSettings, getKeywordsForFilter, getNewsFeed, getSystemHealth } from "@/lib/queries";

type SearchParams = {
  keywordId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: string;
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;

  const settings = await getAppSettings();

  const [feed, keywords, health] = await Promise.all([
    getNewsFeed({
      keywordId: params.keywordId,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      page,
      pageSize: settings.limiteNoticiasExibidas,
    }),
    getKeywordsForFilter(),
    getSystemHealth(),
  ]);

  const hasActiveFilters = Boolean(params.keywordId || params.dateFrom || params.dateTo);

  function buildHref(targetPage: number) {
    const query = new URLSearchParams();
    if (params.keywordId) query.set("keywordId", params.keywordId);
    if (params.dateFrom) query.set("dateFrom", params.dateFrom);
    if (params.dateTo) query.set("dateTo", params.dateTo);
    if (targetPage > 1) query.set("page", String(targetPage));
    const queryString = query.toString();
    return queryString ? `/?${queryString}` : "/";
  }

  return (
    <div className="flex flex-1 justify-center bg-slate-50 px-4 py-8">
      <main className="flex w-full max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-slate-900">Notícias</h1>
          <p className="text-sm text-slate-500">
            Acompanhamento de notícias coletadas por palavra-chave para apoio à decisão.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Notícias encontradas
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{feed.total}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Palavras-chave monitoradas
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{keywords.length}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Status da coleta
            </p>
            <div className="mt-2">
              <HealthIndicator
                lastFinishedAt={health.lastFinishedAt}
                hasAnyJob={health.hasAnyJob}
                isStale={health.isStale}
              />
            </div>
          </div>
        </div>

        <NewsFilters
          keywords={keywords}
          currentKeywordId={params.keywordId}
          currentDateFrom={params.dateFrom}
          currentDateTo={params.dateTo}
        />

        {feed.items.length === 0 ? (
          <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-slate-300 py-16 text-center">
            <p className="text-sm font-medium text-slate-600">
              {hasActiveFilters
                ? "Nenhuma notícia encontrada para os filtros aplicados."
                : "Nenhuma notícia coletada até o momento."}
            </p>
            <p className="text-xs text-slate-400">
              {hasActiveFilters
                ? "Tente ajustar a palavra-chave ou o período."
                : "Assim que os agentes concluírem uma busca, as notícias aparecerão aqui."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {feed.items.map((item) => (
              <NewsCard key={item.id} item={item} />
            ))}
          </div>
        )}

        <Pagination page={feed.page} pageCount={feed.pageCount} buildHref={buildHref} />
      </main>
    </div>
  );
}
