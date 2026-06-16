const HEX_TOKEN = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Normalize a hex token to "#RRGGBB" uppercase, or null if not a hex color. */
export function normalizeHex(token: string): string | null {
  const match = token.trim().match(HEX_TOKEN);
  if (!match) return null;
  let hex = match[1];
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  return `#${hex.toUpperCase()}`;
}

/**
 * Parse pasted text as a pure list of hex colors (e.g. "#FF0000" or
 * "#FF0000, #00FF00 #0000FF"). Returns null unless EVERY token is a hex color,
 * so prose that merely contains a hex isn't hijacked.
 */
export function parsePastedHexColors(text: string): string[] | null {
  const tokens = text.trim().split(/[\s,;]+/).filter(Boolean);
  if (tokens.length === 0 || tokens.length > 24) return null;
  const colors: string[] = [];
  for (const token of tokens) {
    const hex = normalizeHex(token);
    if (!hex) return null;
    colors.push(hex);
  }
  return colors.length ? colors : null;
}
