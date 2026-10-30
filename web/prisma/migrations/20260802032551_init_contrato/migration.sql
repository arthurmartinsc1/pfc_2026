-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('pendente', 'rodando', 'concluido', 'erro');

-- CreateEnum
CREATE TYPE "JobOrigin" AS ENUM ('agendado', 'manual');

-- CreateTable
CREATE TABLE "keywords" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "termo" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "intervalo_minutos" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "keywords_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "keyword_id" UUID NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'pendente',
    "origem" "JobOrigin" NOT NULL,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "erro_msg" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "titulo" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fonte" TEXT,
    "resumo" TEXT NOT NULL,
    "relevancia" DOUBLE PRECISION,
    "data_publicacao_original" TIMESTAMP(3),
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_keyword_matches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "news_item_id" UUID NOT NULL,
    "keyword_id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_keyword_matches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "search_jobs_keyword_id_idx" ON "search_jobs"("keyword_id");

-- CreateIndex
CREATE INDEX "search_jobs_status_idx" ON "search_jobs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "news_items_url_key" ON "news_items"("url");

-- CreateIndex
CREATE INDEX "news_keyword_matches_keyword_id_idx" ON "news_keyword_matches"("keyword_id");

-- CreateIndex
CREATE UNIQUE INDEX "news_keyword_matches_news_item_id_keyword_id_job_id_key" ON "news_keyword_matches"("news_item_id", "keyword_id", "job_id");

-- AddForeignKey
ALTER TABLE "search_jobs" ADD CONSTRAINT "search_jobs_keyword_id_fkey" FOREIGN KEY ("keyword_id") REFERENCES "keywords"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_keyword_matches" ADD CONSTRAINT "news_keyword_matches_news_item_id_fkey" FOREIGN KEY ("news_item_id") REFERENCES "news_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_keyword_matches" ADD CONSTRAINT "news_keyword_matches_keyword_id_fkey" FOREIGN KEY ("keyword_id") REFERENCES "keywords"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_keyword_matches" ADD CONSTRAINT "news_keyword_matches_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "search_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
