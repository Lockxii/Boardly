const TRAILING_URL_PUNCT = /[.,;:!?)]+$/;

export function normalizePastedUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const httpMatch = trimmed.match(/https?:\/\/[^\s<>"']+/i);
  if (httpMatch) return httpMatch[0].replace(TRAILING_URL_PUNCT, "");

  const wwwMatch = trimmed.match(/\bwww\.[^\s<>"']+/i);
  if (wwwMatch) return `https://${wwwMatch[0].replace(TRAILING_URL_PUNCT, "")}`;

  return null;
}

export function extractUrlFromClipboard(data: DataTransfer | null): string | null {
  if (!data) return null;

  const plain = data.getData("text/plain")?.trim();
  const fromPlain = plain ? normalizePastedUrl(plain) : null;
  if (fromPlain) return fromPlain;

  const html = data.getData("text/html");
  if (html) {
    const hrefMatch = html.match(/href=["'](https?:\/\/[^"']+)["']/i);
    if (hrefMatch?.[1]) return hrefMatch[1];

    const srcMatch = html.match(/src=["'](https?:\/\/[^"']+)["']/i);
    if (srcMatch?.[1]) return srcMatch[1];
  }

  return null;
}

export function extractPlainTextFromClipboard(data: DataTransfer | null): string | null {
  if (!data) return null;
  const plain = data.getData("text/plain")?.trim();
  if (!plain || normalizePastedUrl(plain)) return null;
  return plain.slice(0, 5000);
}
