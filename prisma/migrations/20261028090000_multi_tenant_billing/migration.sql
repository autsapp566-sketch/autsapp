-- Multi-tenant B2B SaaS: organizations, plans, subscriptions, usage metering and hard tenant isolation.
--
-- Zero-downtime backfill strategy:
--   1. create the new tables / enums
--   2. add `organizationId` as NULLABLE on every tenant-owned table
--   3. move all pre-existing data into one "legacy" organization (Enterprise, manual billing, no expiry),
--      so the current deployment keeps working exactly as before
--   4. enforce NOT NULL + foreign keys + indexes

-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('STARTER', 'PROFESSIONAL', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED');

-- CreateEnum
CREATE TYPE "BillingProvider" AS ENUM ('STRIPE', 'PADDLE', 'MANUAL');

-- CreateEnum
CREATE TYPE "UsageMetric" AS ENUM ('AI_MESSAGES');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "tier" "PlanTier" NOT NULL,
    "name" TEXT NOT NULL,
    "priceMonthlyCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "maxWhatsAppInstances" INTEGER,
    "monthlyAiMessages" INTEGER,
    "stripePriceId" TEXT,
    "paddlePriceId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "provider" "BillingProvider" NOT NULL DEFAULT 'MANUAL',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "paddleCustomerId" TEXT,
    "paddleSubscriptionId" TEXT,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageLimit" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "metric" "UsageMetric" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    "quota" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsageLimit_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "UsageLimit_used_nonnegative" CHECK ("used" >= 0)
);

-- Seed the plan catalogue (NULL = unlimited). Prices are placeholders: adjust before going live.
-- Keep in sync with src/services/billing/plans.js (npm run db:seed re-applies it idempotently).
INSERT INTO "Plan" ("id", "tier", "name", "priceMonthlyCents", "currency", "maxWhatsAppInstances", "monthlyAiMessages", "sortOrder", "updatedAt")
VALUES
  ('plan_starter',      'STARTER',      'Starter',      2900, 'USD', 1,    1000, 1, CURRENT_TIMESTAMP),
  ('plan_professional', 'PROFESSIONAL', 'Professional', 7900, 'USD', 3,    5000, 2, CURRENT_TIMESTAMP),
  ('plan_enterprise',   'ENTERPRISE',   'Enterprise',      0, 'USD', NULL, NULL, 3, CURRENT_TIMESTAMP);

-- Legacy organization owning everything that existed before multi-tenancy.
INSERT INTO "Organization" ("id", "name", "slug", "updatedAt")
VALUES ('org_legacy', 'Default Organization', 'default', CURRENT_TIMESTAMP);

INSERT INTO "Subscription" ("id", "organizationId", "planId", "status", "provider", "currentPeriodStart", "currentPeriodEnd", "updatedAt")
VALUES ('sub_legacy', 'org_legacy', 'plan_enterprise', 'ACTIVE', 'MANUAL', CURRENT_TIMESTAMP, NULL, CURRENT_TIMESTAMP);

-- AlterTable: add nullable, backfill, then enforce
ALTER TABLE "User" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "KnowledgeItem" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "WhatsAppInstance" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Lead" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Message" ADD COLUMN "organizationId" TEXT;

UPDATE "User" SET "organizationId" = 'org_legacy' WHERE "organizationId" IS NULL;
UPDATE "KnowledgeItem" SET "organizationId" = 'org_legacy' WHERE "organizationId" IS NULL;
UPDATE "WhatsAppInstance" SET "organizationId" = 'org_legacy' WHERE "organizationId" IS NULL;
UPDATE "Lead" SET "organizationId" = 'org_legacy' WHERE "organizationId" IS NULL;
UPDATE "Message" SET "organizationId" = 'org_legacy' WHERE "organizationId" IS NULL;

ALTER TABLE "User" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "KnowledgeItem" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "WhatsAppInstance" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Lead" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Message" ALTER COLUMN "organizationId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_tier_key" ON "Plan"("tier");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_stripePriceId_key" ON "Plan"("stripePriceId");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_paddlePriceId_key" ON "Plan"("paddlePriceId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_organizationId_key" ON "Subscription"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeCustomerId_key" ON "Subscription"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_paddleCustomerId_key" ON "Subscription"("paddleCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_paddleSubscriptionId_key" ON "Subscription"("paddleSubscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "Subscription_currentPeriodEnd_idx" ON "Subscription"("currentPeriodEnd");

-- CreateIndex
CREATE INDEX "Subscription_planId_idx" ON "Subscription"("planId");

-- CreateIndex
CREATE INDEX "UsageLimit_organizationId_metric_periodEnd_idx" ON "UsageLimit"("organizationId", "metric", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "UsageLimit_organizationId_metric_periodStart_key" ON "UsageLimit"("organizationId", "metric", "periodStart");

-- CreateIndex
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- CreateIndex
CREATE INDEX "KnowledgeItem_organizationId_type_idx" ON "KnowledgeItem"("organizationId", "type");

-- CreateIndex
CREATE INDEX "KnowledgeItem_organizationId_updatedAt_idx" ON "KnowledgeItem"("organizationId", "updatedAt");

-- CreateIndex
CREATE INDEX "WhatsAppInstance_organizationId_idx" ON "WhatsAppInstance"("organizationId");

-- CreateIndex
CREATE INDEX "Lead_organizationId_status_idx" ON "Lead"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Lead_organizationId_updatedAt_idx" ON "Lead"("organizationId", "updatedAt");

-- CreateIndex
CREATE INDEX "Message_organizationId_createdAt_idx" ON "Message"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageLimit" ADD CONSTRAINT "UsageLimit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeItem" ADD CONSTRAINT "KnowledgeItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppInstance" ADD CONSTRAINT "WhatsAppInstance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
