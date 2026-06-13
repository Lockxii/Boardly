import {
  cleanMusicLinkTitle,
  detectLinkProviderFromUrl,
  type LinkProviderId,
} from "../src/lib/link-providers.js";
import {
  extractVideoIdFromOEmbedHtml,
  tiktokIdFromUrl,
  twitterStatusIdFromUrl,
  vimeoIdFromUrl,
  youtubeIdFromUrl,
} from "../src/lib/link-media-utils.js";

export type LinkPreviewResult = {
  url: string;
  title: string;
  description: string;
  image: string;
  provider: LinkProviderId;
  author?: string;
  imageWidth?: number;
  imageHeight?: number;
  videoId?: string;
};

type OEmbedPayload = {
  title?: string;
  author_name?: string;
  author_url?: string;
  thumbnail_url?: string;
  thumbnail_width?: number;
  thumbnail_height?: number;
  html?: string;
  provider_name?: string;
};

function pickMeta(html: string, key: string) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']og:${key}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${key}["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${key}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${key}["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return "";
}

function pickTitle(html: string) {
  const og = pickMeta(html, "title");
  if (og) return og;
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m?.[1]?.trim() ?? "";
}

function normalizeHost(hostname: string) {
  return hostname.replace(/^www\./, "").replace(/^m\./, "");
}

function detectProvider(url: URL): LinkProviderId {
  return detectLinkProviderFromUrl(url.toString());
}

function youtubeVideoId(url: URL): string | null {
  return youtubeIdFromUrl(url.toString());
}

function bestYoutubeThumbnail(url: URL, fallback?: string) {
  const id = youtubeVideoId(url);
  if (!id) return fallback || "";
  return `https://img.youtube.com/vi/${id}/maxresdefault.jpg`;
}

function decodeHtmlEntities(value: string) {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([a-f0-9]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => named[name.toLowerCase()] ?? match);
}

function stripHtml(value: string) {
  return decodeHtmlEntities(
    value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s+/g, "\n")
      .trim(),
  );
}

function extractTweetTextFromOEmbedHtml(html = "") {
  const paragraph = html.match(/<blockquote[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i)
    || html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  if (!paragraph?.[1]) return "";
  return stripHtml(paragraph[1]);
}

function twitterHandleFromAuthorUrl(authorUrl?: string) {
  if (!authorUrl) return "";
  try {
    const parsed = new URL(authorUrl);
    return parsed.pathname.split("/").filter(Boolean)[0] || "";
  } catch {
    return "";
  }
}

function normalizeTwitterOEmbedUrl(url: URL) {
  if (!["x.com", "www.x.com"].includes(url.hostname)) return url.toString();
  const copy = new URL(url.toString());
  copy.hostname = "twitter.com";
  return copy.toString();
}

async function fetchOEmbed(endpoint: string, targetUrl: string): Promise<OEmbedPayload | null> {
  const sep = endpoint.includes("?") ? "&" : "?";
  const res = await fetch(`${endpoint}${sep}url=${encodeURIComponent(targetUrl)}&format=json`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "BoardlyBot/1.0 (+https://boardly.app)",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  try {
    return (await res.json()) as OEmbedPayload;
  } catch {
    return null;
  }
}

const OEMBED_ENDPOINTS: Partial<Record<Exclude<LinkProviderId, "generic">, string>> = {
  youtube: "https://www.youtube.com/oembed",
  spotify: "https://open.spotify.com/oembed",
  tiktok: "https://www.tiktok.com/oembed",
  twitter: "https://publish.twitter.com/oembed?omit_script=true&dnt=true",
  soundcloud: "https://soundcloud.com/oembed",
  vimeo: "https://vimeo.com/api/oembed.json",
};

async function fetchOEmbedPreview(url: URL, provider: Exclude<LinkProviderId, "generic">): Promise<LinkPreviewResult | null> {
  const endpoint = OEMBED_ENDPOINTS[provider];
  if (!endpoint) return null;
  const data = await fetchOEmbed(endpoint, provider === "twitter" ? normalizeTwitterOEmbedUrl(url) : url.toString());
  if (!data) return null;
  const tweetText = provider === "twitter" ? extractTweetTextFromOEmbedHtml(data?.html) : "";
  if (!data?.title && !data?.thumbnail_url && !tweetText) return null;

  let image = data.thumbnail_url || "";
  if (provider === "youtube") {
    image = bestYoutubeThumbnail(url, image);
  }

  let imageWidth = data.thumbnail_width || undefined;
  let imageHeight = data.thumbnail_height || undefined;
  if (provider === "youtube" && image.includes("maxresdefault")) {
    imageWidth = imageWidth || 1280;
    imageHeight = imageHeight || 720;
  }

  const author = data.author_name?.trim();
  let title = provider === "twitter" ? tweetText || data.title?.trim() || "Tweet" : data.title?.trim() || url.hostname;
  title = cleanMusicLinkTitle(title, provider);
  let description = "";

  if (provider === "spotify" && author) {
    description = author;
  } else if (provider === "youtube" && author) {
    description = author;
  } else if (provider === "tiktok" && author) {
    description = `@${author.replace(/^@/, "")}`;
  } else if (provider === "twitter") {
    const handle = twitterHandleFromAuthorUrl(data.author_url);
    description = handle ? `@${handle}` : "X / Twitter";
  } else if (author) {
    description = author;
  }

  let videoId: string | undefined;
  if (provider === "youtube") {
    videoId = youtubeVideoId(url) || undefined;
  } else if (provider === "tiktok") {
    videoId = tiktokIdFromUrl(url.toString()) || extractVideoIdFromOEmbedHtml(data.html || "") || undefined;
  } else if (provider === "vimeo") {
    videoId = vimeoIdFromUrl(url.toString()) || undefined;
  } else if (provider === "twitter") {
    videoId = twitterStatusIdFromUrl(url.toString()) || undefined;
  }

  return {
    url: url.toString(),
    title,
    description,
    image,
    provider,
    author: provider === "twitter" && author && description.startsWith("@") ? `${author} ${description}` : author || undefined,
    imageWidth,
    imageHeight,
    videoId,
  };
}

async function fetchOpenGraphPreview(url: URL, timeoutMs = 8000): Promise<LinkPreviewResult> {
  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "BoardlyBot/1.0 (+https://boardly.app)" },
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error("Impossible de récupérer la page");

  const html = (await res.text()).slice(0, 500_000);
  const provider = detectProvider(url);
  let title = pickTitle(html) || url.hostname;
  title = cleanMusicLinkTitle(title, provider);
  const description = pickMeta(html, "description");
  let image = pickMeta(html, "image");
  if (image && image.startsWith("/")) {
    image = `${url.origin}${image}`;
  }
  const imageWidth = Number(pickMeta(html, "image:width")) || undefined;
  const imageHeight = Number(pickMeta(html, "image:height")) || undefined;

  return {
    url: url.toString(),
    title,
    description,
    image,
    provider,
    imageWidth: imageWidth || undefined,
    imageHeight: imageHeight || undefined,
  };
}

export async function fetchLinkPreview(rawUrl: string): Promise<LinkPreviewResult> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("URL invalide");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Protocole non supporté");
  }

  const provider = detectProvider(url);

  if (provider !== "generic") {
    const oembed = await fetchOEmbedPreview(url, provider);
    if (oembed) {
      if (provider !== "twitter" || oembed.image) return oembed;
      try {
        const og = await fetchOpenGraphPreview(url, 3000);
        return {
          ...oembed,
          image: og.image || oembed.image,
          imageWidth: og.imageWidth || oembed.imageWidth,
          imageHeight: og.imageHeight || oembed.imageHeight,
        };
      } catch {
        return oembed;
      }
    }
  }

  const og = await fetchOpenGraphPreview(url);
  if (provider !== "generic") {
    return { ...og, provider };
  }
  return og;
}
