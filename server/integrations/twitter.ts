import { createHash } from "crypto";
import { nanoid } from "nanoid";
import { prisma } from "../prisma.js";
import { getAppOrigin } from "../origin.js";
import type { BoardCanvasData, Layer, LinkMediaType, LinkPreview } from "../../src/lib/types.js";

export const TWITTER_PROVIDER_ID = "twitter";
export const TWITTER_BOARD_TEMPLATE = "twitter-bookmarks";
export const TWITTER_BOARD_TITLE = "Twitter Bookmarks";

export function getTwitterClientId() {
  return process.env.TWITTER_CLIENT_ID || process.env.X_CLIENT_ID || "";
}

export function getTwitterClientSecret() {
  return process.env.TWITTER_CLIENT_SECRET || process.env.X_CLIENT_SECRET || "";
}

export function getTwitterRedirectUri() {
  return process.env.TWITTER_REDIRECT_URI || `${getAppOrigin()}/api/integrations/twitter/callback`;
}

export function isTwitterConfigured() {
  return !!getTwitterClientId();
}

export function base64Url(buffer: Buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function codeChallengeFromVerifier(verifier: string) {
  return base64Url(createHash("sha256").update(verifier).digest());
}

export async function twitterTokenRequest(body: URLSearchParams) {
  const clientId = getTwitterClientId();
  const clientSecret = getTwitterClientSecret();
  if (!clientId) throw new Error("Twitter non configuré");

  body.set("client_id", clientId);
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (clientSecret) {
    headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
  }

  const response = await fetch("https://api.x.com/2/oauth2/token", {
    method: "POST",
    headers,
    body,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload?.error_description === "string"
      ? payload.error_description
      : typeof payload?.error === "string"
        ? payload.error
        : "Connexion Twitter impossible";
    throw new Error(message);
  }
  return payload as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
  };
}

export type TwitterAccount = {
  id: string;
  accountId: string;
  accessToken: string | null;
  refreshToken: string | null;
  accessTokenExpiresAt: Date | null;
  scope: string | null;
};

export async function findTwitterAccount(userId: string) {
  return prisma.account.findFirst({
    where: { userId, providerId: TWITTER_PROVIDER_ID },
    select: {
      id: true,
      accountId: true,
      accessToken: true,
      refreshToken: true,
      accessTokenExpiresAt: true,
      scope: true,
    },
  });
}

async function getValidTwitterAccessToken(account: TwitterAccount, forceRefresh = false) {
  const expiresAt = account.accessTokenExpiresAt?.getTime() ?? 0;
  if (!forceRefresh && account.accessToken && (!expiresAt || expiresAt > Date.now() + 60_000)) {
    return account.accessToken;
  }

  if (!account.refreshToken) {
    if (account.accessToken) return account.accessToken;
    throw new Error("Reconnectez Twitter");
  }

  const tokens = await twitterTokenRequest(new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: account.refreshToken,
  }));
  const accessTokenExpiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000)
    : account.accessTokenExpiresAt;

  const updated = await prisma.account.update({
    where: { id: account.id },
    data: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || account.refreshToken,
      accessTokenExpiresAt,
      scope: tokens.scope || account.scope,
    },
    select: {
      accessToken: true,
      refreshToken: true,
      accessTokenExpiresAt: true,
      scope: true,
    },
  });

  account.accessToken = updated.accessToken;
  account.refreshToken = updated.refreshToken;
  account.accessTokenExpiresAt = updated.accessTokenExpiresAt;
  account.scope = updated.scope;
  return tokens.access_token;
}

type TwitterBookmarksResponse = {
  data?: {
    id: string;
    text: string;
    author_id?: string;
    attachments?: { media_keys?: string[] };
  }[];
  includes?: {
    users?: { id: string; name: string; username: string }[];
    media?: {
      media_key: string;
      type: string;
      url?: string;
      preview_image_url?: string;
      width?: number;
      height?: number;
      variants?: {
        bit_rate?: number;
        content_type?: string;
        url?: string;
      }[];
    }[];
  };
  meta?: { next_token?: string; result_count?: number };
  errors?: unknown[];
};

export async function fetchTwitterBookmarks(account: TwitterAccount) {
  const configuredLimit = Number(process.env.TWITTER_BOOKMARK_IMPORT_LIMIT || 1000);
  const maxBookmarks = Number.isFinite(configuredLimit) && configuredLimit > 0 ? configuredLimit : 1000;
  const tweets: NonNullable<TwitterBookmarksResponse["data"]> = [];
  const users = new Map<string, { id: string; name: string; username: string }>();
  const media = new Map<string, NonNullable<NonNullable<TwitterBookmarksResponse["includes"]>["media"]>[number]>();
  let paginationToken: string | undefined;
  let token = await getValidTwitterAccessToken(account);

  for (let page = 0; page < 10 && tweets.length < maxBookmarks; page++) {
    const url = new URL(`https://api.x.com/2/users/${encodeURIComponent(account.accountId)}/bookmarks`);
    url.searchParams.set("max_results", "100");
    url.searchParams.set("tweet.fields", "attachments,author_id,created_at,public_metrics");
    url.searchParams.set("expansions", "author_id,attachments.media_keys");
    url.searchParams.set("media.fields", "preview_image_url,url,width,height,type,variants,duration_ms");
    url.searchParams.set("user.fields", "name,username");
    if (paginationToken) url.searchParams.set("pagination_token", paginationToken);

    let response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 401 && account.refreshToken) {
      token = await getValidTwitterAccessToken(account, true);
      response = await fetch(url, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
    }

    const payload = await response.json().catch(() => ({})) as TwitterBookmarksResponse & { detail?: string; title?: string };
    if (!response.ok) {
      throw new Error(payload.detail || payload.title || "Impossible d'importer les bookmarks Twitter");
    }

    for (const user of payload.includes?.users || []) users.set(user.id, user);
    for (const item of payload.includes?.media || []) media.set(item.media_key, item);
    tweets.push(...(payload.data || []));
    paginationToken = payload.meta?.next_token;
    if (!paginationToken) break;
  }

  return tweets.slice(0, maxBookmarks).map<LinkPreview>((tweet) => {
    const author = tweet.author_id ? users.get(tweet.author_id) : undefined;
    const firstMediaKey = tweet.attachments?.media_keys?.[0];
    const item = firstMediaKey ? media.get(firstMediaKey) : undefined;
    const mediaType = normalizeTwitterMediaType(item?.type);
    const videoSrc = isPlayableTwitterMedia(mediaType) ? bestTwitterVideoVariantUrl(item) : undefined;
    const image = item?.url || item?.preview_image_url || "";
    const username = author?.username || "i";
    const url = `https://x.com/${username}/status/${tweet.id}`;

    return {
      url,
      title: tweet.text || "Tweet",
      description: author?.username ? `@${author.username}` : "X / Twitter",
      image,
      provider: "twitter",
      author: author ? `${author.name} @${author.username}` : undefined,
      imageWidth: item?.width,
      imageHeight: item?.height,
      videoId: tweet.id,
      videoSrc,
      mediaType,
    };
  });
}

function normalizeTwitterMediaType(type?: string): LinkMediaType | undefined {
  return type === "photo" || type === "video" || type === "animated_gif" ? type : undefined;
}

function isPlayableTwitterMedia(type?: string) {
  return type === "video" || type === "animated_gif";
}

function bestTwitterVideoVariantUrl(
  media?: NonNullable<NonNullable<TwitterBookmarksResponse["includes"]>["media"]>[number],
) {
  const variants = media?.variants || [];
  const mp4Variants = variants
    .filter((variant) => variant.url && variant.content_type === "video/mp4")
    .sort((a, b) => (b.bit_rate || 0) - (a.bit_rate || 0));
  return mp4Variants[0]?.url || variants.find((variant) => variant.url && variant.content_type?.startsWith("video/"))?.url;
}

export function buildTwitterBookmarksCanvas(previews: LinkPreview[]): BoardCanvasData {
  const layers: Record<string, Layer> = {};
  const layerIds: string[] = [];
  const add = (layer: Layer) => {
    const id = nanoid();
    layers[id] = layer;
    layerIds.push(id);
    return id;
  };
  const importedAt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date());

  add({
    type: "Text",
    x: 48,
    y: 40,
    width: 560,
    height: 48,
    fill: "transparent",
    value: "Bookmarks Twitter",
    fontSize: 34,
    textColor: "#111827",
    fontWeight: "700",
  });
  add({
    type: "Note",
    x: 48,
    y: 104,
    width: 420,
    height: 86,
    fill: "#DBEAFE",
    value: `<b>${previews.length} tweet${previews.length > 1 ? "s" : ""} importé${previews.length > 1 ? "s" : ""}</b><br/>Dernière synchronisation : ${importedAt}`,
    cornerRadius: 12,
  });

  if (previews.length === 0) {
    add({
      type: "Note",
      x: 500,
      y: 104,
      width: 360,
      height: 86,
      fill: "#FEF3C7",
      value: "Aucun bookmark trouvé sur ce compte Twitter.",
      cornerRadius: 12,
    });
  }

  const startX = 48;
  let y = 230;
  let rowHeight = 0;
  const columns = 4;
  const gap = 28;
  const columnWidth = 448;

  previews.forEach((preview, index) => {
    const col = index % columns;
    if (col === 0 && index > 0) {
      y += rowHeight + gap;
      rowHeight = 0;
    }
    const { width, height } = getTwitterLinkLayerDimensions(preview);
    add({
      type: "Link",
      x: startX + col * columnWidth,
      y,
      width,
      height,
      fill: "#ffffff",
      url: preview.url,
      linkTitle: preview.title,
      linkDescription: preview.description,
      linkImage: preview.image,
      linkProvider: "twitter",
      linkAuthor: preview.author,
      linkImageWidth: preview.imageWidth,
      linkImageHeight: preview.imageHeight,
      linkVideoId: preview.videoId,
      linkVideoSrc: preview.videoSrc,
      linkMediaType: preview.mediaType,
      cornerRadius: 10,
      stroke: "#E2E8F0",
      strokeWidth: 1,
    });
    rowHeight = Math.max(rowHeight, height);
  });

  return {
    layers,
    layerIds,
    connections: [],
    versions: [],
    layerComments: {},
    reactions: {},
    trash: [],
    brandColors: ["#111111", "#1D9BF0", "#60A5FA", "#F59E0B", "#10B981"],
    auditLog: [{
      id: nanoid(),
      userId: "system",
      userName: "Twitter",
      action: "imported",
      layerType: `Tweet x${previews.length}`,
      timestamp: Date.now(),
    }],
    chatMessages: [],
  };
}

function getTwitterLinkLayerDimensions(preview: LinkPreview) {
  const width = 420;
  if (!preview.image) return { width, height: 462 };
  const hasSubtitle = !!(preview.author || preview.description);
  const titleLines = Math.min(6, Math.max(1, Math.ceil((preview.title || "").length / 30)));
  const titleHeight = titleLines * 19;
  const subtitleHeight = hasSubtitle ? 18 : 0;
  const bodyHeight = Math.max(116, titleHeight + subtitleHeight + 26);
  const chrome = bodyHeight + 28 + 4;
  const imageHeight = preview.imageWidth && preview.imageHeight && preview.imageWidth > 0 && preview.imageHeight > 0
    ? Math.round(width * (preview.imageHeight / preview.imageWidth))
    : Math.round(width / (16 / 9));
  return { width, height: imageHeight + chrome };
}
