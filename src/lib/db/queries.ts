import { prisma } from "@/lib/db/prisma";

export const DEFAULT_PAGE_SIZE = 10;
export const APP_SETTINGS_ID = "default";

export type NewsFeedFilters = {
  keywordId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

export async function getNewsFeed(filters: NewsFeedFilters) {
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const pageSize = filters.pageSize && filters.pageSize > 0 ? filters.pageSize : DEFAULT_PAGE_SIZE;

  const search = filters.search?.trim();

  const where = {
    descartada: false,
    ...(filters.keywordId && {
      matches: { some: { keywordId: filters.keywordId } },
    }),
    ...(search && {
      OR: [
        { titulo: { contains: search, mode: "insensitive" as const } },
        { resumo: { contains: search, mode: "insensitive" as const } },
      ],
    }),
    ...((filters.dateFrom || filters.dateTo) && {
      fetchedAt: {
        ...(filters.dateFrom && { gte: new Date(`${filters.dateFrom}T00:00:00`) }),
        ...(filters.dateTo && { lte: new Date(`${filters.dateTo}T23:59:59.999`) }),
      },
    }),
  };

  const [items, total] = await Promise.all([
    prisma.newsItem.findMany({
      where,
      include: { matches: { include: { keyword: true } } },
      orderBy: { fetchedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.newsItem.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getKeywordsForFilter() {
  return prisma.keyword.findMany({ orderBy: { termo: "asc" } });
}

export async function getKeywordById(id: string) {
  return prisma.keyword.findUnique({ where: { id } });
}

export async function getKeywordsWithStatus() {
  return prisma.keyword.findMany({
    orderBy: { termo: "asc" },
    include: {
      searchJobs: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { searchJobs: true } },
    },
  });
}

export async function getAppSettings() {
  return prisma.appSettings.upsert({
    where: { id: APP_SETTINGS_ID },
    create: { id: APP_SETTINGS_ID },
    update: {},
  });
}

export type KeywordNewsCount = { id: string; termo: string; total: number };

// Distribuição de notícias por palavra-chave para o gráfico do painel.
// COUNT(DISTINCT news_item_id) evita contar duas vezes a mesma notícia
// vinculada à mesma keyword por jobs diferentes; ainda assim uma notícia
// que casa com N keywords conta uma vez em cada — por isso a soma das
// fatias pode exceder o total de notícias (comunicado na legenda da UI).
export async function getKeywordDistribution() {
  const [rows, totalNews] = await Promise.all([
    prisma.$queryRaw<{ id: string; termo: string; total: bigint }[]>`
      SELECT k.id, k.termo, COUNT(DISTINCT m.news_item_id) AS total
      FROM keywords k
      JOIN news_keyword_matches m ON m.keyword_id = k.id
      JOIN news_items n ON n.id = m.news_item_id AND n.descartada = false
      GROUP BY k.id, k.termo
      ORDER BY total DESC, k.termo ASC
    `,
    prisma.newsItem.count({ where: { descartada: false } }),
  ]);

  return {
    perKeyword: rows.map((row): KeywordNewsCount => ({ ...row, total: Number(row.total) })),
    totalNews,
  };
}

export type NewsPerDay = { dia: string; total: number };

export const NEWS_PER_DAY_WINDOW = 14;

// Notícias coletadas por dia (janela recente) para o gráfico de barras do
// painel. Dias sem coleta não vêm do banco — o preenchimento com zero é
// feito na interface, que conhece a janela completa.
export async function getNewsPerDay(): Promise<NewsPerDay[]> {
  const rows = await prisma.$queryRaw<{ dia: string; total: number }[]>`
    SELECT to_char(date_trunc('day', fetched_at), 'YYYY-MM-DD') AS dia,
           COUNT(*)::int AS total
    FROM news_items
    WHERE descartada = false
      AND fetched_at >= CURRENT_DATE - make_interval(days => ${NEWS_PER_DAY_WINDOW - 1})
    GROUP BY 1
    ORDER BY 1
  `;
  return rows.map((row) => ({ dia: row.dia, total: Number(row.total) }));
}

const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export async function getSystemHealth() {
  const [lastConcluido, totalJobs] = await Promise.all([
    prisma.searchJob.aggregate({
      _max: { finishedAt: true },
      where: { status: "concluido" },
    }),
    prisma.searchJob.count(),
  ]);

  const lastFinishedAt = lastConcluido._max.finishedAt;

  return {
    lastFinishedAt,
    hasAnyJob: totalJobs > 0,
    isStale: lastFinishedAt ? Date.now() - lastFinishedAt.getTime() > STALE_AFTER_MS : false,
  };
}
