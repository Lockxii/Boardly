import { prisma } from "./prisma.js";

let schemaReady: Promise<void> | null = null;

/**
 * Idempotent schema patches for production when prisma db push wasn't run.
 * Safe to call on every cold start — uses IF NOT EXISTS.
 */
export function ensureBoardSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      try {
        await prisma.$executeRawUnsafe(`
          ALTER TABLE "board" ADD COLUMN IF NOT EXISTS "folder" TEXT;
        `);
        await prisma.$executeRawUnsafe(`
          ALTER TABLE "board" ADD COLUMN IF NOT EXISTS "tags" TEXT[] NOT NULL DEFAULT '{}';
        `);
        await prisma.$executeRawUnsafe(`
          ALTER TABLE "board" ADD COLUMN IF NOT EXISTS "isPublic" BOOLEAN NOT NULL DEFAULT false;
        `);
        await prisma.$executeRawUnsafe(`
          ALTER TABLE "board" ADD COLUMN IF NOT EXISTS "shareToken" TEXT;
        `);
        await prisma.$executeRawUnsafe(`
          ALTER TABLE "board" ADD COLUMN IF NOT EXISTS "rev" INTEGER NOT NULL DEFAULT 0;
        `);
        await prisma.$executeRawUnsafe(`
          CREATE UNIQUE INDEX IF NOT EXISTS "board_shareToken_key" ON "board" ("shareToken");
        `);
        await prisma.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "board_authorId_idx" ON "board" ("authorId");
        `);
        await prisma.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "board_authorId_template_idx" ON "board" ("authorId", "template");
        `);
      } catch (error) {
        console.error("Schema sync failed:", error);
        throw error;
      }
    })();
  }
  return schemaReady;
}
