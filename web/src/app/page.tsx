import type { CSSProperties } from "react";
import { HealthIndicator } from "@/components/features/system-health/health-indicator";
import { NewsFilters } from "@/components/features/news-feed/news-filters";
import { NewsCard } from "@/components/features/news-feed/news-card";
import { Pagination } from "@/components/ui/pagination";
import { InboxIcon, SearchIcon } from "@/components/ui/icons";
import { KeywordDonut } from "@/components/features/dashboard/keyword-donut";
import { NewsPerDayChart } from "@/components/features/dashboard/news-per-day-chart";
import {
  getAppSettings,
  getKeywordDistribution,
  getKeywordsForFilter,
  getNewsFeed,
  getNewsPerDay,
  getSystemHealth,
} from "@/lib/db/queries";

type SearchParams = {
  keywordId?: string;
  dateFrom?: string;
  dateTo?: string;
  q?: string;
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

  const [feed, keywords, health, distribution, perDay] = await Promise.all([
    getNewsFeed({
      keywordId: params.keywordId,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      search: params.q,
      page,
      pageSize: settings.limiteNoticiasExibidas,
    }),
    getKeywordsForFilter(),
    getSystemHealth(),
    getKeywordDistribution(),
    getNewsPerDay(),
  ]);

  const hasActiveFilters = Boolean(
    params.keywordId || params.dateFrom || params.dateTo || params.q
  );
  // A coleta sem execução recente é a informação mais urgente da tela —
  // ela se destaca por posição/borda/ícone, não só pela cor do texto.
  const healthNeedsAttention = health.isStale || !health.lastFinishedAt;

  function buildHref(targetPage: number) {
    const query = new URLSearchParams();
    if (params.keywordId) query.set("keywordId", params.keywordId);
    if (params.dateFrom) query.set("dateFrom", params.dateFrom);
    if (params.dateTo) query.set("dateTo", params.dateTo);
    if (params.q) query.set("q", params.q);
    if (targetPage > 1) query.set("page", String(targetPage));
    const queryString = query.toString();
    return queryString ? `/?${queryString}` : "/";
  }

  return (
    <div className="flex flex-1 justify-center px-4 py-8">
      <main className="flex w-full max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="font-display text-4xl font-semibold text-khaki">Notícias</h1>
          <p className="text-sm text-sage">
            Acompanhamento de notícias coletadas por assunto para apoio à decisão.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="border border-khaki/10 bg-panel p-4">
            <p className="text-xs font-medium text-sage">
              Notícias encontradas
            </p>
            <p className="mt-1 font-display text-4xl font-semibold tabular-nums text-khaki">
              {feed.total}
            </p>
          </div>
          <div className="border border-khaki/10 bg-panel p-4">
            <p className="text-xs font-medium text-sage">
              Assuntos monitorados
            </p>
            <p className="mt-1 font-display text-4xl font-semibold tabular-nums text-khaki">
              {keywords.length}
            </p>
          </div>
          <div
            className={`border border-l-4 bg-panel p-4 ${
              healthNeedsAttention
                ? "border-khaki/10 border-l-signal"
                : "border-khaki/10 border-l-olive"
            }`}
          >
            <p className="text-xs font-medium text-sage">
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

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <KeywordDonut
            perKeyword={distribution.perKeyword}
            totalNews={distribution.totalNews}
          />
          <NewsPerDayChart perDay={perDay} />
        </div>

        <NewsFilters
          keywords={keywords}
          currentKeywordId={params.keywordId}
          currentDateFrom={params.dateFrom}
          currentDateTo={params.dateTo}
          currentSearch={params.q}
        />

        {feed.items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 border border-dashed border-khaki/20 py-16 text-center">
            {hasActiveFilters ? (
              <SearchIcon className="h-6 w-6 text-sage" />
            ) : (
              <InboxIcon className="h-6 w-6 text-sage" />
            )}
            <p className="text-sm font-medium text-khaki">
              {hasActiveFilters
                ? "Nenhuma notícia encontrada para os filtros aplicados."
                : "Nenhuma notícia coletada até o momento."}
            </p>
            <p className="text-xs text-sage">
              {hasActiveFilters
                ? "Tente ajustar o assunto ou o período."
                : "Assim que os agentes concluírem uma busca, as notícias aparecerão aqui."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {feed.items.map((item, index) => (
              <div
                key={item.id}
                className="animate-enter"
                style={{ "--enter-delay": `${Math.min(index, 8) * 60}ms` } as CSSProperties}
              >
                <NewsCard item={item} />
              </div>
            ))}
          </div>
        )}

        <Pagination page={feed.page} pageCount={feed.pageCount} buildHref={buildHref} />
      </main>
    </div>
  );
}
