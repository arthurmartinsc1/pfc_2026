-- AlterTable
ALTER TABLE "keywords" ADD COLUMN     "termos_relacionados" TEXT[] DEFAULT ARRAY[]::TEXT[];
