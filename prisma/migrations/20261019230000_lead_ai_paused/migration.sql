-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "aiPaused" BOOLEAN NOT NULL DEFAULT false;

-- Sync existing human takeovers
UPDATE "Lead" SET "aiPaused" = true WHERE "status" = 'HANDED_OFF';
