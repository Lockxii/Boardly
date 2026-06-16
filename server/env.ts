import "dotenv/config";
import { z } from "zod";

/**
 * Centralized, fail-fast environment validation.
 *
 * Importing this module loads `.env` (via `dotenv/config`) and validates the
 * required variables once. In production a missing/weak secret throws at boot
 * with a clear message instead of silently falling back to an insecure value.
 */

const isProduction =
  process.env.NODE_ENV === "production" || process.env.VERCEL === "1";

/** Only used for LOCAL development when no secret is configured. Never in prod. */
const DEV_AUTH_SECRET = "dev-only-insecure-secret-do-not-use-in-production";

const envSchema = z.object({
  NODE_ENV: z.string().optional(),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DATABASE_URL_UNPOOLED: z.string().optional(),
  BETTER_AUTH_SECRET: z
    .string()
    .min(16, "BETTER_AUTH_SECRET must be at least 16 characters")
    .optional(),
  BETTER_AUTH_URL: z.string().optional(),
  CLIENT_ORIGIN: z.string().optional(),
  LIVEBLOCKS_SECRET_KEY: z.string().optional(),
  LIVEBLOCKS_SECRET: z.string().optional(),
  GOOGLE_AI_API_KEY: z.string().optional(),
  PORT: z.string().optional(),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  const data = parsed.data;

  let authSecret = data.BETTER_AUTH_SECRET;
  if (!authSecret) {
    if (isProduction) {
      throw new Error(
        "BETTER_AUTH_SECRET is required in production. Generate one with `openssl rand -base64 32`.",
      );
    }
    console.warn(
      "⚠️  BETTER_AUTH_SECRET is not set — using an insecure development secret. Set one before deploying.",
    );
    authSecret = DEV_AUTH_SECRET;
  }

  return { ...data, isProduction, authSecret };
}

export const env = loadEnv();
