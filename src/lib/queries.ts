import { prisma } from "@/lib/prisma";

export const DEFAULT_PAGE_SIZE = 10;
export const APP_SETTINGS_ID = "default";

export type NewsFeedFilters = {
  keywordId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
};

export async function getNewsFeed(filters: NewsFeedFilters) {
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const pageSize = filters.pageSize && filters.pageSize > 0 ? filters.pageSize : DEFAULT_PAGE_SIZE;

  const where = {
    descartada: false,
    ...(filters.keywordId && {
      matches: { some: { keywordId: filters.keywordId } },
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
