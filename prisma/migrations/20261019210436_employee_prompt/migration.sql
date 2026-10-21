-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AiSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "textModel" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "sttEnabled" BOOLEAN NOT NULL DEFAULT true,
    "ttsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "ttsVoice" TEXT NOT NULL DEFAULT 'nova',
    "employeePrompt" TEXT NOT NULL DEFAULT '',
    "systemPrompt" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_AiSettings" ("id", "sttEnabled", "systemPrompt", "textModel", "ttsEnabled", "ttsVoice", "updatedAt") SELECT "id", "sttEnabled", "systemPrompt", "textModel", "ttsEnabled", "ttsVoice", "updatedAt" FROM "AiSettings";
DROP TABLE "AiSettings";
ALTER TABLE "new_AiSettings" RENAME TO "AiSettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
