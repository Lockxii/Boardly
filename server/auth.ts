import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma.js";
import { env } from "./env.js";

export function getAuthBaseURL() {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/^https?:\/\//, "")}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:5173";
}

export function getTrustedOrigins() {
  const origins = new Set<string>(["http://localhost:5173", "http://127.0.0.1:5173"]);

  const addOrigin = (value?: string) => {
    if (!value) return;
    const normalized = value.replace(/\/$/, "");
    origins.add(normalized.startsWith("http") ? normalized : `https://${normalized}`);
  };

  addOrigin(process.env.BETTER_AUTH_URL);
  addOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined);
  addOrigin(process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);
  addOrigin(process.env.VERCEL_BRANCH_URL ? `https://${process.env.VERCEL_BRANCH_URL}` : undefined);
  addOrigin(process.env.CLIENT_ORIGIN);

  return [...origins];
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  secret: env.authSecret,
  baseURL: getAuthBaseURL(),
  trustedOrigins: getTrustedOrigins(),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 60,
  },
  user: {
    additionalFields: {},
  },
});
