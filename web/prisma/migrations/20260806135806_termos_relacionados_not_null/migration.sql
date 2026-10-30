-- Alinha com a spec acordada: coluna NOT NULL (o default '{}' já cobre
-- linhas antigas e inserts que omitem a coluna).
UPDATE "keywords" SET "termos_relacionados" = '{}' WHERE "termos_relacionados" IS NULL;
ALTER TABLE "keywords" ALTER COLUMN "termos_relacionados" SET NOT NULL;
