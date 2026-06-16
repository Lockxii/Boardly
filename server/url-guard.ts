import dns from "node:dns/promises";
import net from "node:net";

/**
 * SSRF protection for server-side fetches of user-supplied URLs.
 *
 * Before any request, the target host is resolved and every resolved IP is
 * checked against private/loopback/link-local/reserved ranges (incl. the cloud
 * metadata endpoint 169.254.169.254). Redirects are followed manually so each
 * hop is re-validated. Response bodies can be capped to bound memory/exfil.
 */

export class SsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SsrfError";
  }
}

function isBlockedIpv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return true; // malformed → block
  }
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // private
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local incl. 169.254.169.254 (cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
  if (a === 192 && b === 0) return true; // 192.0.0/24 + 192.0.2/24 (test)
  if (a >= 224) return true; // multicast (224/4) + reserved (240/4) + broadcast
  return false;
}

function isBlockedIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true; // loopback / unspecified
  const mapped = lower.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped) return isBlockedIpv4(mapped[1]);
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // fc00::/7 ULA
  if (/^fe[89ab]/.test(lower)) return true; // fe80::/10 link-local
  return false;
}

export function isBlockedIp(ip: string): boolean {
  const kind = net.isIP(ip);
  if (kind === 4) return isBlockedIpv4(ip);
  if (kind === 6) return isBlockedIpv6(ip);
  return true; // not a valid IP literal → block
}

async function assertHostAllowed(hostname: string): Promise<void> {
  const host = hostname.replace(/^\[|\]$/g, ""); // strip IPv6 brackets

  if (net.isIP(host)) {
    if (isBlockedIp(host)) {
      throw new SsrfError(`Adresse non autorisée: ${host}`);
    }
    return;
  }

  const lower = host.toLowerCase();
  if (
    lower === "localhost" ||
    lower.endsWith(".localhost") ||
    lower.endsWith(".local") ||
    lower.endsWith(".internal") ||
    lower.endsWith(".lan")
  ) {
    throw new SsrfError(`Hôte non autorisé: ${host}`);
  }

  let records: { address: string }[];
  try {
    records = await dns.lookup(host, { all: true });
  } catch {
    throw new SsrfError(`Résolution DNS impossible: ${host}`);
  }
  if (!records.length) throw new SsrfError(`Aucune adresse pour: ${host}`);
  for (const record of records) {
    if (isBlockedIp(record.address)) {
      throw new SsrfError(`Adresse interne bloquée pour: ${host}`);
    }
  }
}

/** Validate a URL is safe to fetch server-side; returns the parsed URL or throws SsrfError. */
export async function assertUrlAllowed(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SsrfError("URL invalide");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SsrfError("Protocole non supporté");
  }
  const port = url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80;
  if (port !== 80 && port !== 443) {
    throw new SsrfError("Port non autorisé");
  }
  await assertHostAllowed(url.hostname);
  return url;
}

export type SafeFetchOptions = {
  maxRedirects?: number;
  timeoutMs?: number;
};

/**
 * Fetch a user-supplied URL with SSRF protection and manual redirect
 * re-validation. Each redirect hop is checked before it is followed.
 */
export async function safeFetch(
  rawUrl: string,
  init: RequestInit = {},
  options: SafeFetchOptions = {},
): Promise<Response> {
  const maxRedirects = options.maxRedirects ?? 3;
  const timeoutMs = options.timeoutMs ?? 8000;
  let currentUrl = rawUrl;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const url = await assertUrlAllowed(currentUrl);
    const res = await fetch(url, {
      ...init,
      redirect: "manual",
      signal: init.signal ?? AbortSignal.timeout(timeoutMs),
    });

    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      currentUrl = new URL(location, url).toString();
      // body is discarded; loop re-validates the next hop
      continue;
    }
    return res;
  }

  throw new SsrfError("Trop de redirections");
}

/** Read a response body as text, aborting if it exceeds `maxBytes`. */
export async function readTextCapped(res: Response, maxBytes: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return (await res.text()).slice(0, maxBytes);

  const decoder = new TextDecoder();
  let out = "";
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      out += decoder.decode(value.subarray(0, Math.max(0, maxBytes - (total - value.byteLength))));
      await reader.cancel();
      break;
    }
    out += decoder.decode(value, { stream: true });
  }
  return out;
}
