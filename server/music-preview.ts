import { cleanMusicLinkTitle, detectLinkProviderFromUrl } from "../src/lib/link-providers.js";
import { getMusicEmbedUrl } from "../src/lib/link-media-utils.js";

export type MusicPreviewResult = {
  previewUrl?: string;
  embedUrl?: string;
  duration?: number;
};

type ItunesTrack = {
  wrapperType?: string;
  kind?: string;
  previewUrl?: string;
  trackTimeMillis?: number;
  trackName?: string;
  artistName?: string;
};

function parseAppleMusicUrl(url: string) {
  const parsed = new URL(url);
  const parts = parsed.pathname.split("/").filter(Boolean);
  const country = parts[0]?.length === 2 ? parts[0] : "fr";
  const numericId = parts.find((part) => /^\d+$/.test(part));
  const slugIndex = parts.findIndex((part) => part === "album" || part === "song");
  const slug = slugIndex >= 0 ? parts[slugIndex + 1] : undefined;
  const songId = parsed.searchParams.get("i") || undefined;

  return {
    country,
    numericId,
    songId,
    slug,
    embedUrl: `https://embed.music.apple.com${parsed.pathname}${parsed.search}`,
  };
}

function slugToSearchTerm(slug?: string) {
  if (!slug) return "";
  return slug
    .replace(/-feat-/gi, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function itunesLookup(country: string, lookupId: string, entity?: string) {
  const params = new URLSearchParams({ id: lookupId });
  if (entity) {
    params.set("entity", entity);
    params.set("limit", "5");
  }
  const res = await fetch(`https://itunes.apple.com/${country}/lookup?${params}`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  return (await res.json()) as { results?: ItunesTrack[] };
}

async function itunesSearch(country: string, term: string) {
  const params = new URLSearchParams({
    term,
    entity: "song",
    limit: "8",
  });
  const res = await fetch(`https://itunes.apple.com/${country}/search?${params}`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  return (await res.json()) as { results?: ItunesTrack[] };
}

function pickTrack(results: ItunesTrack[] | undefined, hints: string[]) {
  if (!results?.length) return null;
  const normalizedHints = hints.map((h) => h.toLowerCase()).filter(Boolean);
  const scored = results
    .filter((item) => item.previewUrl)
    .map((item) => {
      const haystack = `${item.trackName || ""} ${item.artistName || ""}`.toLowerCase();
      const score = normalizedHints.reduce(
        (acc, hint) => acc + (haystack.includes(hint) ? hint.length : 0),
        0,
      );
      return { item, score };
    })
    .sort((a, b) => b.score - a.score);

  if (scored[0]?.score > 0) return scored[0].item;
  return scored[0]?.item || results.find((item) => item.previewUrl) || null;
}

async function fetchApplePreview(url: string, title?: string): Promise<MusicPreviewResult> {
  const { country, numericId, songId, slug, embedUrl } = parseAppleMusicUrl(url);
  const cleanedTitle = title ? cleanMusicLinkTitle(title, "apple-music") : "";
  const hints = [
    cleanedTitle.split("(")[0]?.trim() || "",
    cleanedTitle,
    slugToSearchTerm(slug),
  ].filter(Boolean);

  try {
    if (songId) {
      const data = await itunesLookup(country, songId);
      const track = pickTrack(data?.results, hints);
      if (track?.previewUrl) {
        return {
          previewUrl: track.previewUrl,
          duration: Math.max(1, Math.round((track.trackTimeMillis || 30_000) / 1000)),
        };
      }
    }

    if (numericId) {
      const data = await itunesLookup(country, numericId, "song");
      const track = pickTrack(data?.results, hints);
      if (track?.previewUrl) {
        return {
          previewUrl: track.previewUrl,
          duration: Math.max(1, Math.round((track.trackTimeMillis || 30_000) / 1000)),
        };
      }
    }

    for (const term of hints) {
      const data = await itunesSearch(country, term);
      const track = pickTrack(data?.results, hints);
      if (track?.previewUrl) {
        return {
          previewUrl: track.previewUrl,
          duration: Math.max(1, Math.round((track.trackTimeMillis || 30_000) / 1000)),
        };
      }
    }
  } catch {
    /* fallback embed */
  }

  return { embedUrl };
}

async function fetchDeezerPreview(url: string): Promise<MusicPreviewResult> {
  const trackMatch = url.match(/track\/(\d+)/i);
  if (trackMatch) {
    try {
      const res = await fetch(`https://api.deezer.com/track/${trackMatch[1]}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const data = (await res.json()) as { preview?: string; duration?: number };
        if (data.preview) {
          return { previewUrl: data.preview, duration: data.duration || 30 };
        }
      }
    } catch {
      /* fallback */
    }
  }

  const albumMatch = url.match(/album\/(\d+)/i);
  if (albumMatch) {
    try {
      const res = await fetch(`https://api.deezer.com/album/${albumMatch[1]}/tracks?limit=1`, {
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const data = (await res.json()) as { data?: { id: number }[] };
        const firstTrackId = data.data?.[0]?.id;
        if (firstTrackId) {
          const trackRes = await fetch(`https://api.deezer.com/track/${firstTrackId}`, {
            signal: AbortSignal.timeout(8000),
          });
          if (trackRes.ok) {
            const track = (await trackRes.json()) as { preview?: string; duration?: number };
            if (track.preview) {
              return { previewUrl: track.preview, duration: track.duration || 30 };
            }
          }
        }
      }
    } catch {
      /* fallback */
    }
  }

  const embedUrl = getMusicEmbedUrl("deezer", url, { autoplay: true });
  return embedUrl ? { embedUrl } : {};
}

export async function fetchMusicPreview(rawUrl: string, title?: string): Promise<MusicPreviewResult> {
  const provider = detectLinkProviderFromUrl(rawUrl);

  if (provider === "apple-music") {
    return fetchApplePreview(rawUrl, title);
  }
  if (provider === "deezer") {
    return fetchDeezerPreview(rawUrl);
  }
  if (provider === "spotify" || provider === "soundcloud") {
    const embedUrl = getMusicEmbedUrl(provider, rawUrl, { autoplay: true });
    return embedUrl ? { embedUrl } : {};
  }

  return {};
}

export async function fetchMusicPreviewHandler(url: string, title?: string) {
  if (!url) throw new Error("URL requise");
  const provider = detectLinkProviderFromUrl(url);
  if (!["spotify", "soundcloud", "apple-music", "deezer"].includes(provider)) {
    throw new Error("Lien musical non supporté");
  }
  return fetchMusicPreview(url, title);
}
