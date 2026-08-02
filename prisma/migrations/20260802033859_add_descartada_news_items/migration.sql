-- AlterTable
ALTER TABLE "news_items" ADD COLUMN     "descartada" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "news_items_descartada_idx" ON "news_items"("descartada");
