-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_KnowledgeItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "answer" TEXT NOT NULL DEFAULT '',
    "priceDh" INTEGER,
    "imageUrl" TEXT,
    "imageUrls" TEXT NOT NULL DEFAULT '[]',
    "colors" TEXT NOT NULL DEFAULT '[]',
    "sizes" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_KnowledgeItem" ("answer", "createdAt", "description", "id", "imageUrl", "priceDh", "title", "type", "updatedAt") SELECT "answer", "createdAt", "description", "id", "imageUrl", "priceDh", "title", "type", "updatedAt" FROM "KnowledgeItem";
DROP TABLE "KnowledgeItem";
ALTER TABLE "new_KnowledgeItem" RENAME TO "KnowledgeItem";
CREATE INDEX "KnowledgeItem_type_idx" ON "KnowledgeItem"("type");
CREATE INDEX "KnowledgeItem_updatedAt_idx" ON "KnowledgeItem"("updatedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
