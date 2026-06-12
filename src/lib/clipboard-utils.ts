const TRAILING_URL_PUNCT = /[.,;:!?)]+$/;
const URL_IN_TEXT =
  /https?:\/\/[^\s<>"']+|(?:\bwww\.[^\s<>"']+)/gi;

export function normalizePastedUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const httpMatch = trimmed.match(/https?:\/\/[^\s<>"']+/i);
  if (httpMatch) return httpMatch[0].replace(TRAILING_URL_PUNCT, "");

  const wwwMatch = trimmed.match(/\bwww\.[^\s<>"']+/i);
  if (wwwMatch) return `https://${wwwMatch[0].replace(TRAILING_URL_PUNCT, "")}`;

  return null;
}

export function extractUrlsFromText(text: string): string[] {
  const found = new Set<string>();
  const matches = text.match(URL_IN_TEXT) || [];
  for (const raw of matches) {
    const normalized = normalizePastedUrl(raw);
    if (normalized) found.add(normalized);
  }

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const normalized = normalizePastedUrl(trimmed);
    if (normalized) found.add(normalized);
  }

  return [...found];
}

export function extractUrlsFromClipboard(data: DataTransfer | null): string[] {
  if (!data) return [];

  const plain = data.getData("text/plain")?.trim();
  const fromPlain = plain ? extractUrlsFromText(plain) : [];
  if (fromPlain.length > 0) return fromPlain;

  const html = data.getData("text/html");
  if (!html) return [];

  const fromHtml = new Set<string>();
  const hrefMatches = html.matchAll(/href=["'](https?:\/\/[^"']+)["']/gi);
  for (const match of hrefMatches) {
    const normalized = normalizePastedUrl(match[1]);
    if (normalized) fromHtml.add(normalized);
  }
  return [...fromHtml];
}

/** @deprecated use extractUrlsFromClipboard()[0] */
export function extractUrlFromClipboard(data: DataTransfer | null): string | null {
  return extractUrlsFromClipboard(data)[0] ?? null;
}

export function extractPlainTextFromClipboard(data: DataTransfer | null): string | null {
  if (!data) return null;
  const plain = data.getData("text/plain")?.trim();
  if (!plain) return null;
  if (extractUrlsFromText(plain).length > 0) return null;
  return plain.slice(0, 5000);
}

export function isLikelyUrlInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (/^www\./i.test(trimmed)) return true;
  if (extractUrlsFromText(trimmed).length > 0) return true;
  return /^[\w.-]+\.(com|fr|io|net|org|be|co|app|tv|music)\/\S+/i.test(trimmed);
}

export function normalizeUrlInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const fromExtract = extractUrlsFromText(trimmed);
  if (fromExtract[0]) return fromExtract[0];
  if (/^www\./i.test(trimmed)) return normalizePastedUrl(trimmed);
  if (/^[\w.-]+\.[a-z]{2,}\/\S+/i.test(trimmed)) return `https://${trimmed}`;
  return null;
}
