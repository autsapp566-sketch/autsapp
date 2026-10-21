-- CreateTable
CREATE TABLE "WhatsAppInstance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "instanceName" TEXT NOT NULL,
    "label" TEXT,
    "phone" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppInstance_instanceName_key" ON "WhatsAppInstance"("instanceName");
