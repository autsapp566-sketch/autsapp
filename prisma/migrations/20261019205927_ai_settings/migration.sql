-- CreateTable
CREATE TABLE "AiSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "textModel" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "sttEnabled" BOOLEAN NOT NULL DEFAULT true,
    "ttsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "ttsVoice" TEXT NOT NULL DEFAULT 'nova',
    "systemPrompt" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);
