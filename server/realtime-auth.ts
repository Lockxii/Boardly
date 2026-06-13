import { createHmac, timingSafeEqual } from "crypto";

export type RealtimeTokenUser = {
  id: string;
  email: string;
  name: string;
};

type RealtimeTokenPayload = RealtimeTokenUser & {
  exp: number;
};

const TOKEN_TTL_SECONDS = 5 * 60;

function getRealtimeSecret() {
  return process.env.REALTIME_AUTH_SECRET || process.env.BETTER_AUTH_SECRET || "dev-only-insecure-secret";
}

function encode(input: unknown) {
  return Buffer.from(JSON.stringify(input)).toString("base64url");
}

function sign(payload: string) {
  return createHmac("sha256", getRealtimeSecret()).update(payload).digest("base64url");
}

export function createRealtimeToken(user: RealtimeTokenUser) {
  const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const payload = encode({ ...user, exp: expiresAt } satisfies RealtimeTokenPayload);
  return {
    token: `${payload}.${sign(payload)}`,
    expiresAt: expiresAt * 1000,
  };
}

export function verifyRealtimeToken(token: unknown): RealtimeTokenUser | null {
  if (typeof token !== "string") return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(actualBuffer, expectedBuffer)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as RealtimeTokenPayload;
    if (!parsed.id || !parsed.email || !parsed.name || parsed.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return { id: parsed.id, email: parsed.email, name: parsed.name };
  } catch {
    return null;
  }
}

export function getRealtimeWebhookSecret() {
  return getRealtimeSecret();
}
