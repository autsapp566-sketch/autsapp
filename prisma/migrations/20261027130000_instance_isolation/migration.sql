-- Strict per-number isolation: every conversation (Lead) and message belongs to one WhatsApp instance.
-- Idempotent on purpose (IF NOT EXISTS / duplicate_object guards): safe to run on databases created with `db push`.

ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "instanceId" TEXT;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "instanceId" TEXT;

CREATE INDEX IF NOT EXISTS "Lead_instanceId_phone_idx" ON "Lead"("instanceId", "phone");
CREATE INDEX IF NOT EXISTS "Lead_instanceId_updatedAt_idx" ON "Lead"("instanceId", "updatedAt");
CREATE INDEX IF NOT EXISTS "Message_instanceId_idx" ON "Message"("instanceId");

DO $$ BEGIN
  ALTER TABLE "Lead" ADD CONSTRAINT "Lead_instanceId_fkey"
    FOREIGN KEY ("instanceId") REFERENCES "WhatsAppInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Message" ADD CONSTRAINT "Message_instanceId_fkey"
    FOREIGN KEY ("instanceId") REFERENCES "WhatsAppInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Backfill: everything that existed before this migration was received on the (single) default number.
UPDATE "Lead"
SET "instanceId" = (SELECT "id" FROM "WhatsAppInstance" WHERE "isDefault" = true ORDER BY "updatedAt" DESC LIMIT 1)
WHERE "instanceId" IS NULL;

UPDATE "Message" m
SET "instanceId" = l."instanceId"
FROM "Lead" l
WHERE m."leadId" = l."id" AND m."instanceId" IS NULL AND l."instanceId" IS NOT NULL;
