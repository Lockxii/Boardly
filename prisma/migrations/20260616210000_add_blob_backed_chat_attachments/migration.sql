ALTER TABLE "chat_attachment" ADD COLUMN IF NOT EXISTS "boardId" TEXT;
ALTER TABLE "chat_attachment" ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "chat_attachment" ADD COLUMN IF NOT EXISTS "url" TEXT;
ALTER TABLE "chat_attachment" ADD COLUMN IF NOT EXISTS "pathname" TEXT;
ALTER TABLE "chat_attachment" ADD COLUMN IF NOT EXISTS "storageProvider" TEXT NOT NULL DEFAULT 'database';
ALTER TABLE "chat_attachment" ALTER COLUMN "data" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "chat_attachment_boardId_idx" ON "chat_attachment" ("boardId");
CREATE INDEX IF NOT EXISTS "chat_attachment_userId_idx" ON "chat_attachment" ("userId");

DO $$
BEGIN
  ALTER TABLE "chat_attachment"
    ADD CONSTRAINT "chat_attachment_boardId_fkey"
    FOREIGN KEY ("boardId") REFERENCES "board"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "chat_attachment"
    ADD CONSTRAINT "chat_attachment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
