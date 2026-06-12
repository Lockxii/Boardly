import type { LinkProvider } from "@/lib/link-providers";

export const LINK_PROVIDER_ACCENT: Record<LinkProvider, string> = {
  youtube: "#FF0000",
  spotify: "#1DB954",
  tiktok: "#FFFFFF",
  soundcloud: "#FF5500",
  vimeo: "#1AB7EA",
  "apple-music": "#FA243C",
  deezer: "#A238FF",
  "amazon-music": "#00A8E1",
};

export function isVideoLinkProvider(provider?: string) {
  return provider === "youtube" || provider === "tiktok" || provider === "vimeo";
}

function hashSeed(seed: string) {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function generateWaveformBars(seed: string, count = 48): number[] {
  let hash = hashSeed(seed || "boardly");
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    hash = (Math.imul(hash, 1664525) + 1013904223) >>> 0;
    bars.push(0.12 + (hash % 88) / 100);
  }
  return bars;
}

export function fakeTrackDurationSeconds(seed: string) {
  const hash = hashSeed(seed || "track");
  return 75 + (hash % 226);
}

export function formatTrackTime(totalSeconds: number) {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function youtubeIdFromUrl(url?: string) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "").replace(/^m\./, "");
    if (host === "youtu.be") return parsed.pathname.slice(1).split("/")[0] || null;
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts[0] === "shorts" || parts[0] === "embed" || parts[0] === "live") return parts[1] || null;
    return parsed.searchParams.get("v");
  } catch {
    return null;
  }
}

export function tiktokIdFromUrl(url?: string) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/video\/(\d+)/);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

export function vimeoIdFromUrl(url?: string) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    return last && /^\d+$/.test(last) ? last : null;
  } catch {
    return null;
  }
}

export function getVideoEmbedUrl(provider: LinkProvider | "generic" | undefined, url?: string) {
  if (!url || !provider || provider === "generic") return null;

  if (provider === "youtube") {
    const id = youtubeIdFromUrl(url);
    if (!id) return null;
    return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&controls=0&modestbranding=1&playsinline=1&rel=0&loop=1&playlist=${id}`;
  }

  if (provider === "tiktok") {
    const id = tiktokIdFromUrl(url);
    if (!id) return null;
    return `https://www.tiktok.com/embed/v2/${id}?autoplay=1&mute=1`;
  }

  if (provider === "vimeo") {
    const id = vimeoIdFromUrl(url);
    if (!id) return null;
    return `https://player.vimeo.com/video/${id}?autoplay=1&muted=1&background=1&loop=1`;
  }

  return null;
}
