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
      } catch (error) {
        console.error("Schema sync failed:", error);
        throw error;
      }
    })();
  }
  return schemaReady;
}
