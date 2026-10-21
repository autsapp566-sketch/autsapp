-- AlterTable
ALTER TABLE "WhatsAppInstance" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'green';
ALTER TABLE "WhatsAppInstance" ADD COLUMN "greenInstanceId" TEXT;
ALTER TABLE "WhatsAppInstance" ADD COLUMN "greenApiToken" TEXT;
ALTER TABLE "WhatsAppInstance" ADD COLUMN "greenApiUrl" TEXT;

CREATE INDEX "WhatsAppInstance_greenInstanceId_idx" ON "WhatsAppInstance"("greenInstanceId");
