import express from "express";
import cors from "cors";
import { createHash, randomBytes } from "crypto";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Liveblocks } from "@liveblocks/node";
import { toNodeHandler, fromNodeHeaders } from "better-auth/node";
import { nanoid } from "nanoid";
import type { Prisma } from "@prisma/client";
import { auth } from "./auth.js";
import { prisma } from "./prisma.js";
import { ensureBoardSchema } from "./schema-sync.js";
import { fetchLinkPreview } from "./link-preview.js";
import { fetchMusicPreviewHandler } from "./music-preview.js";
import { buildTemplateCanvas } from "./board-seeds.js";
import { chatWithFred, isFredConfigured, streamChatWithFred } from "./fred-ai.js";
import { getBoardAccess } from "./board-access.js";
import type { BoardCanvasData, Layer, LinkMediaType, LinkPreview } from "../src/lib/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getAppOrigin() {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/^https?:\/\//, "")}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:5173";
}

function getLiveblocksSecret() {
  return process.env.LIVEBLOCKS_SECRET_KEY || process.env.LIVEBLOCKS_SECRET;
}

const TWITTER_PROVIDER_ID = "twitter";
const TWITTER_BOARD_TEMPLATE = "twitter-bookmarks";
const TWITTER_BOARD_TITLE = "Twitter Bookmarks";

function getTwitterClientId() {
  return process.env.TWITTER_CLIENT_ID || process.env.X_CLIENT_ID || "";
}

function getTwitterClientSecret() {
  return process.env.TWITTER_CLIENT_SECRET || process.env.X_CLIENT_SECRET || "";
}

function getTwitterRedirectUri() {
  return process.env.TWITTER_REDIRECT_URI || `${getAppOrigin()}/api/integrations/twitter/callback`;
}

function isTwitterConfigured() {
  return !!getTwitterClientId();
}

function base64Url(buffer: Buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function codeChallengeFromVerifier(verifier: string) {
  return base64Url(createHash("sha256").update(verifier).digest());
}

async function twitterTokenRequest(body: URLSearchParams) {
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

type TwitterAccount = {
  id: string;
  accountId: string;
  accessToken: string | null;
  refreshToken: string | null;
  accessTokenExpiresAt: Date | null;
  scope: string | null;
};

async function findTwitterAccount(userId: string) {
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

async function fetchTwitterBookmarks(account: TwitterAccount) {
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

function buildTwitterBookmarksCanvas(previews: LinkPreview[]): BoardCanvasData {
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

function boardIdFromLiveblocksRoom(room: unknown) {
  if (typeof room !== "string") return null;
  const prefix = "board:";
  if (!room.startsWith(prefix)) return null;
  const boardId = room.slice(prefix.length).trim();
  return boardId || null;
}

async function getSessionUser(req: express.Request) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  return session?.user ?? null;
}

function requireAuth(handler: (req: express.Request, res: express.Response, user: NonNullable<Awaited<ReturnType<typeof getSessionUser>>>) => Promise<unknown>) {
  return async (req: express.Request, res: express.Response) => {
    try {
      const user = await getSessionUser(req);
      if (!user) return res.status(401).json({ error: "Non autorisé" });
      return await handler(req, res, user);
    } catch (error) {
      console.error(`API ${req.method} ${req.path}:`, error);
      if (res.headersSent) return;
      res.status(500).json({
        error: error instanceof Error ? error.message : "Erreur serveur",
      });
    }
  };
}

function serializeBoard(
  board: {
    id: string;
    title: string;
    authorId: string;
    template: string;
    thumbnail: string | null;
    folder?: string | null;
    tags?: string[];
    isPublic?: boolean;
    createdAt: Date;
    updatedAt: Date;
    author?: { name: string } | null;
  },
  meta: { role: "owner" | "editor"; isOwner: boolean }
) {
  return {
    id: board.id,
    title: board.title,
    authorId: board.authorId,
    template: board.template,
    thumbnail: board.thumbnail,
    folder: board.folder ?? null,
    tags: board.tags ?? [],
    isPublic: board.isPublic ?? false,
    createdAt: board.createdAt,
    updatedAt: board.updatedAt,
    role: meta.role,
    isOwner: meta.isOwner,
    authorName: board.author?.name ?? null,
  };
}

export function createApp() {
  const app = express();
  const origin = getAppOrigin();

  app.use(cors({ origin, credentials: true }));

  // Better Auth must be mounted before express.json()
  app.all("/api/auth/*splat", toNodeHandler(auth));

  app.use(express.json({ limit: "50mb" }));

  app.use("/api/boards", async (_req, _res, next) => {
    try {
      await ensureBoardSchema();
      next();
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/health", async (_req, res) => {
    const checks: Record<string, boolean | string> = {
      databaseUrl: !!process.env.DATABASE_URL,
      authSecret: !!process.env.BETTER_AUTH_SECRET,
      authBaseUrl: getAppOrigin(),
      fredAi: isFredConfigured(),
    };

    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = true;
      await ensureBoardSchema();
      await prisma.board.findFirst({ select: { id: true } });
      checks.boardSchema = true;
    } catch (error) {
      checks.database = false;
      checks.databaseError = error instanceof Error ? error.message : "unknown";
    }

    const ok =
      checks.database === true &&
      checks.boardSchema === true &&
      checks.databaseUrl === true &&
      checks.authSecret === true;
    res.status(ok ? 200 : 503).json({ ok, checks });
  });

  app.get("/api/integrations/twitter/status", requireAuth(async (_req, res, user) => {
    await ensureBoardSchema();
    const [account, board] = await Promise.all([
      findTwitterAccount(user.id),
      prisma.board.findFirst({
        where: { authorId: user.id, template: TWITTER_BOARD_TEMPLATE },
        orderBy: { createdAt: "asc" },
        select: { id: true, updatedAt: true },
      }),
    ]);

    res.json({
      configured: isTwitterConfigured(),
      connected: !!account,
      accountId: account?.accountId ?? null,
      boardId: board?.id ?? null,
      boardUpdatedAt: board?.updatedAt ?? null,
    });
  }));

  app.get("/api/integrations/twitter/start", requireAuth(async (_req, res, user) => {
    if (!isTwitterConfigured()) return res.status(500).json({ error: "Twitter non configuré" });

    await prisma.verification.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    const state = randomBytes(24).toString("hex");
    const codeVerifier = base64Url(randomBytes(64));
    await prisma.verification.create({
      data: {
        identifier: `twitter:${state}`,
        value: JSON.stringify({ userId: user.id, codeVerifier }),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    const url = new URL("https://x.com/i/oauth2/authorize");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", getTwitterClientId());
    url.searchParams.set("redirect_uri", getTwitterRedirectUri());
    url.searchParams.set("scope", "tweet.read users.read bookmark.read offline.access");
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", codeChallengeFromVerifier(codeVerifier));
    url.searchParams.set("code_challenge_method", "S256");
    res.redirect(url.toString());
  }));

  app.get("/api/integrations/twitter/callback", async (req, res) => {
    const origin = getAppOrigin();
    const redirectWith = (status: "connected" | "error") => res.redirect(`${origin}/dashboard?twitter=${status}`);

    try {
      const state = String(req.query.state || "");
      const code = String(req.query.code || "");
      if (req.query.error || !state || !code) return redirectWith("error");

      const verification = await prisma.verification.findFirst({
        where: { identifier: `twitter:${state}` },
        orderBy: { createdAt: "desc" },
      });
      if (!verification || verification.expiresAt < new Date()) return redirectWith("error");

      const { userId, codeVerifier } = JSON.parse(verification.value) as { userId?: string; codeVerifier?: string };
      if (!userId || !codeVerifier) return redirectWith("error");

      const tokens = await twitterTokenRequest(new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: getTwitterRedirectUri(),
        code_verifier: codeVerifier,
      }));

      const meResponse = await fetch("https://api.x.com/2/users/me?user.fields=name,username", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const me = await meResponse.json().catch(() => ({})) as { data?: { id?: string } };
      if (!meResponse.ok || !me.data?.id) throw new Error("Compte Twitter introuvable");

      const accessTokenExpiresAt = tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000)
        : undefined;
      const existing = await prisma.account.findFirst({
        where: { userId, providerId: TWITTER_PROVIDER_ID },
        select: { id: true },
      });
      const data = {
        accountId: me.data.id,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        accessTokenExpiresAt,
        scope: tokens.scope,
      };

      if (existing) {
        await prisma.account.update({ where: { id: existing.id }, data });
      } else {
        await prisma.account.create({
          data: {
            userId,
            providerId: TWITTER_PROVIDER_ID,
            ...data,
          },
        });
      }

      await prisma.verification.delete({ where: { id: verification.id } }).catch(() => null);
      return redirectWith("connected");
    } catch (error) {
      console.error("Twitter OAuth callback failed:", error);
      return redirectWith("error");
    }
  });

  app.post("/api/integrations/twitter/import", requireAuth(async (_req, res, user) => {
    await ensureBoardSchema();
    const account = await findTwitterAccount(user.id);
    if (!account) return res.status(400).json({ error: "Connectez Twitter avant d'importer" });

    const previews = await fetchTwitterBookmarks(account);
    const canvasData = buildTwitterBookmarksCanvas(previews);
    const existingBoards = await prisma.board.findMany({
      where: { authorId: user.id, template: TWITTER_BOARD_TEMPLATE },
      orderBy: { createdAt: "asc" },
    });
    const [existing, ...duplicates] = existingBoards;
    if (duplicates.length > 0) {
      await prisma.board.updateMany({
        where: { id: { in: duplicates.map((board) => board.id) }, authorId: user.id },
        data: { template: "blank", tags: [] },
      });
    }
    const data = {
      title: TWITTER_BOARD_TITLE,
      template: TWITTER_BOARD_TEMPLATE,
      folder: "Intégrations",
      tags: ["twitter", "bookmarks"],
      canvasData: canvasData as unknown as Prisma.InputJsonValue,
    };

    const board = existing
      ? await prisma.board.update({ where: { id: existing.id }, data })
      : await prisma.board.create({ data: { ...data, authorId: user.id } });

    res.json({
      board: serializeBoard(board, { role: "owner", isOwner: true }),
      canvasData,
      updatedAt: board.updatedAt,
      importedCount: previews.length,
    });
  }));

  app.post("/api/liveblocks-auth", requireAuth(async (req, res, user) => {
    const secret = getLiveblocksSecret();
    if (!secret) return res.status(500).json({ error: "Liveblocks non configuré" });
    if (!user.email) return res.status(400).json({ error: "Email utilisateur manquant" });

    const room = String(req.body?.room || "");
    const boardId = boardIdFromLiveblocksRoom(room);
    if (!boardId) return res.status(400).json({ error: "invalid_room" });

    const access = await getBoardAccess(boardId, user as { id: string; email: string });
    if (!access) return res.status(403).json({ error: "forbidden", reason: "Accès refusé" });

    const liveblocks = new Liveblocks({ secret });
    const session = liveblocks.prepareSession(user.id, {
      userInfo: {
        name: user.name,
        email: user.email,
        role: access.role,
      },
    });

    session.allow(room, session.FULL_ACCESS);
    const { body, status } = await session.authorize();
    res.status(status).type("application/json").send(body);
  }));

  // --- BOARD ROUTES ---

  app.get("/api/boards", requireAuth(async (req, res, user) => {
    const email = user.email;
    if (!email) return res.status(400).json({ error: "Email utilisateur manquant" });

    const [ownedBoards, sharedBoards] = await Promise.all([
      prisma.board.findMany({
        where: { authorId: user.id },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.board.findMany({
        where: {
          authorId: { not: user.id },
          members: { some: { email } },
        },
        include: { author: { select: { name: true } } },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    res.json([
      ...ownedBoards.map((board) => serializeBoard(board, { role: "owner", isOwner: true })),
      ...sharedBoards.map((board) => serializeBoard(board, { role: "editor", isOwner: false })),
    ]);
  }));

  app.post("/api/boards", requireAuth(async (req, res, user) => {
    const { title = "Untitled Board", template = "blank" } = req.body;
    const seed = buildTemplateCanvas(template);
    const board = await prisma.board.create({
      data: {
        title,
        template,
        authorId: user.id,
        canvasData: seed ?? undefined,
      },
    });
    res.json(serializeBoard(board, { role: "owner", isOwner: true }));
  }));

  app.get("/api/link-preview", requireAuth(async (req, res) => {
    const url = String(req.query.url || "");
    if (!url) return res.status(400).json({ error: "URL requise" });
    try {
      const preview = await fetchLinkPreview(url);
      res.json(preview);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Preview impossible" });
    }
  }));

  app.get("/api/music-preview", requireAuth(async (req, res) => {
    const url = String(req.query.url || "");
    const title = String(req.query.title || "");
    if (!url) return res.status(400).json({ error: "URL requise" });
    try {
      const preview = await fetchMusicPreviewHandler(url, title || undefined);
      res.json(preview);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Preview impossible" });
    }
  }));

  // --- FRED AI ---

  app.get("/api/fred/status", requireAuth(async (_req, res) => {
    res.json({ configured: isFredConfigured() });
  }));

  app.post("/api/fred/chat", requireAuth(async (req, res, user) => {
    const { message, history, boardContext, boardId, visionAssets, toolMode } = req.body as {
      message?: string;
      history?: { role: "user" | "assistant"; content: string }[];
      boardContext?: Record<string, unknown>;
      boardId?: string;
      visionAssets?: { label: string; mimeType?: string; data?: string; src?: string }[];
      toolMode?: Parameters<typeof chatWithFred>[0]["toolMode"];
    };

    if (!message?.trim()) return res.status(400).json({ error: "Message requis" });

    if (boardId) {
      const access = await getBoardAccess(boardId, user as { id: string; email: string });
      if (!access) return res.status(403).json({ error: "Accès refusé" });
    }

    try {
      const result = await chatWithFred({
        message: message.trim(),
        history,
        boardContext: boardContext as Parameters<typeof chatWithFred>[0]["boardContext"],
        visionAssets,
        toolMode,
      });
      res.json(result);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erreur Fred AI";
      const status = msg.includes("GOOGLE_AI_API_KEY") ? 503 : 500;
      res.status(status).json({ error: msg });
    }
  }));

  app.post("/api/fred/chat/stream", requireAuth(async (req, res, user) => {
    const { message, history, boardContext, boardId, visionAssets, toolMode } = req.body as {
      message?: string;
      history?: { role: "user" | "assistant"; content: string }[];
      boardContext?: Record<string, unknown>;
      boardId?: string;
      visionAssets?: { label: string; mimeType?: string; data?: string; src?: string }[];
      toolMode?: Parameters<typeof chatWithFred>[0]["toolMode"];
    };

    if (!message?.trim()) return res.status(400).json({ error: "Message requis" });

    if (boardId) {
      const access = await getBoardAccess(boardId, user as { id: string; email: string });
      if (!access) return res.status(403).json({ error: "Accès refusé" });
    }

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    try {
      for await (const event of streamChatWithFred({
        message: message.trim(),
        history,
        boardContext: boardContext as Parameters<typeof chatWithFred>[0]["boardContext"],
        visionAssets,
        toolMode,
      })) {
        res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      }
      res.end();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erreur Fred AI";
      const status = msg.includes("GOOGLE_AI_API_KEY") ? 503 : 500;
      if (!res.headersSent) {
        res.status(status).json({ error: msg });
      } else {
        res.write(`event: error\ndata: ${JSON.stringify({ error: msg })}\n\n`);
        res.end();
      }
    }
  }));

  app.get("/api/public/boards/:id", async (req, res) => {
    const boardId = String(req.params.id);
    await ensureBoardSchema();
    const board = await prisma.board.findUnique({
      where: { id: boardId },
      include: { author: { select: { name: true } } },
    });
    if (!board?.isPublic) return res.status(404).json({ error: "Tableau non public" });
    res.json({
      id: board.id,
      title: board.title,
      template: board.template,
      thumbnail: board.thumbnail,
      authorName: board.author?.name ?? null,
      updatedAt: board.updatedAt,
    });
  });

  app.get("/api/public/boards/:id/content", async (req, res) => {
    const boardId = String(req.params.id);
    await ensureBoardSchema();
    const board = await prisma.board.findUnique({ where: { id: boardId } });
    if (!board?.isPublic) return res.status(404).json({ error: "Tableau non public" });
    res.json({
      canvasData: board.canvasData ?? null,
      thumbnail: board.thumbnail,
      updatedAt: board.updatedAt,
    });
  });

  app.delete("/api/boards/:id", requireAuth(async (req, res, user) => {
    const boardId = String(req.params.id);
    const access = await getBoardAccess(boardId, user as { id: string; email: string });
    if (!access?.isOwner) return res.status(403).json({ error: "Seul le créateur peut supprimer ce tableau" });
    await prisma.board.delete({ where: { id: boardId } });
    res.json({ success: true });
  }));

  app.get("/api/boards/:id", requireAuth(async (req, res, user) => {
    const boardId = String(req.params.id);
    const access = await getBoardAccess(boardId, user as { id: string; email: string });
    if (!access) return res.status(403).json({ error: "Accès refusé" });
    res.json(serializeBoard(access.board, { role: access.role, isOwner: access.isOwner }));
  }));

  app.put("/api/boards/:id/title", requireAuth(async (req, res, user) => {
    const boardId = String(req.params.id);
    const { title } = req.body;
    const access = await getBoardAccess(boardId, user as { id: string; email: string });
    if (!access?.isOwner) return res.status(403).json({ error: "Seul le créateur peut renommer ce tableau" });
    const updated = await prisma.board.update({ where: { id: boardId }, data: { title } });
    res.json(serializeBoard(updated, { role: access.role, isOwner: access.isOwner }));
  }));

  app.patch("/api/boards/:id", requireAuth(async (req, res, user) => {
    const boardId = String(req.params.id);
    const access = await getBoardAccess(boardId, user as { id: string; email: string });
    if (!access?.isOwner) return res.status(403).json({ error: "Seul le créateur peut modifier ce tableau" });
    const { folder, tags, isPublic } = req.body as { folder?: string | null; tags?: string[]; isPublic?: boolean };
    const data: { folder?: string | null; tags?: string[]; isPublic?: boolean } = {};
    if (folder !== undefined) data.folder = folder || null;
    if (Array.isArray(tags)) data.tags = tags;
    if (typeof isPublic === "boolean") data.isPublic = isPublic;
    const updated = await prisma.board.update({ where: { id: boardId }, data });
    res.json(serializeBoard(updated, { role: access.role, isOwner: access.isOwner }));
  }));

  app.post("/api/boards/:id/duplicate", requireAuth(async (req, res, user) => {
    const boardId = String(req.params.id);
    const access = await getBoardAccess(boardId, user as { id: string; email: string });
    if (!access) return res.status(403).json({ error: "Accès refusé" });
    const copy = await prisma.board.create({
      data: {
        title: `${access.board.title} (copie)`,
        template: access.board.template === TWITTER_BOARD_TEMPLATE ? "blank" : access.board.template,
        authorId: user.id,
        canvasData: access.board.canvasData ?? undefined,
        thumbnail: access.board.thumbnail,
        folder: access.board.folder,
        tags: access.board.template === TWITTER_BOARD_TEMPLATE
          ? access.board.tags.filter((tag) => tag !== "twitter" && tag !== "bookmarks")
          : access.board.tags,
      },
    });
    res.json(serializeBoard(copy, { role: "owner", isOwner: true }));
  }));

  app.get("/api/boards/:id/content", requireAuth(async (req, res, user) => {
    const boardId = String(req.params.id);
    const access = await getBoardAccess(boardId, user as { id: string; email: string });
    if (!access) return res.status(403).json({ error: "Accès refusé" });

    const canvasData = access.board.canvasData;
    res.json({
      canvasData: canvasData ?? null,
      thumbnail: access.board.thumbnail,
      updatedAt: access.board.updatedAt,
    });
  }));

  app.put("/api/boards/:id/content", requireAuth(async (req, res, user) => {
    const boardId = String(req.params.id);
    const access = await getBoardAccess(boardId, user as { id: string; email: string });
    if (!access) return res.status(403).json({ error: "Accès refusé" });

    const { canvasData, thumbnail } = req.body;
    if (!canvasData || typeof canvasData !== "object") {
      return res.status(400).json({ error: "canvasData requis" });
    }

    const updated = await prisma.board.update({
      where: { id: boardId },
      data: {
        canvasData,
        thumbnail: typeof thumbnail === "string" ? thumbnail : access.board.thumbnail,
      },
    });

    res.json({
      success: true,
      updatedAt: updated.updatedAt,
      thumbnail: updated.thumbnail,
    });
  }));

  // --- MEMBERS ROUTES ---

  app.get("/api/boards/:id/members", requireAuth(async (req, res, user) => {
    const boardId = String(req.params.id);
    const access = await getBoardAccess(boardId, user as { id: string; email: string });
    if (!access) return res.status(403).json({ error: "Accès refusé" });
    const members = await prisma.boardMember.findMany({ where: { boardId } });
    res.json(members);
  }));

  app.post("/api/boards/:id/join", requireAuth(async (req, res, user) => {
    const boardId = String(req.params.id);
    const board = await prisma.board.findUnique({ where: { id: boardId } });
    if (!board) return res.status(404).json({ error: "Tableau introuvable" });

    const authUser = user as { id: string; email: string };
    if (!authUser.email) return res.status(400).json({ error: "Email utilisateur manquant" });
    if (board.authorId === authUser.id) {
      return res.json({ success: true, role: "owner" });
    }

    await prisma.boardMember.upsert({
      where: { boardId_email: { boardId, email: authUser.email } },
      update: {},
      create: { boardId, email: authUser.email, role: "editor" },
    });
    res.json({ success: true, role: "editor" });
  }));

  app.delete("/api/boards/:id/members/:email", requireAuth(async (req, res, user) => {
    const boardId = String(req.params.id);
    const email = decodeURIComponent(String(req.params.email));
    const access = await getBoardAccess(boardId, user as { id: string; email: string });
    if (!access?.isOwner) return res.status(403).json({ error: "Seul le créateur peut retirer des membres" });
    await prisma.boardMember.deleteMany({ where: { boardId, email } });
    res.json({ success: true });
  }));

  // --- FILE UPLOAD ---

  app.post("/api/upload", requireAuth(async (req, res) => {
    const { name, type, size, data } = req.body;
    if (!data) return res.status(400).json({ error: "No data" });
    const attachment = await prisma.chatAttachment.create({
      data: { name, type, size, data },
    });
    res.json({ url: `/api/file/${attachment.id}`, id: attachment.id });
  }));

  app.get("/api/file/:fileId", async (req, res) => {
    const fileId = String(req.params.fileId);
    const attachment = await prisma.chatAttachment.findUnique({ where: { id: fileId } });
    if (!attachment) return res.status(404).json({ error: "Not found" });
    const base64 = attachment.data;
    const matches = base64.match(/^data:([^;]+);base64,(.+)$/);
    if (matches) {
      const buffer = Buffer.from(matches[2], "base64");
      res.setHeader("Content-Type", matches[1]);
      res.setHeader("Content-Disposition", `inline; filename="${attachment.name}"`);
      res.send(buffer);
    } else {
      res.setHeader("Content-Type", attachment.type);
      res.send(Buffer.from(base64, "base64"));
    }
  });

  if (process.env.SERVE_STATIC === "true") {
    const staticDir = path.resolve(__dirname, "../dist");
    const indexFile = path.join(staticDir, "index.html");

    if (existsSync(indexFile)) {
      app.use(express.static(staticDir));
      app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) => {
        res.sendFile(indexFile);
      });
    }
  }

  app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) return next(err);
    console.error("API error:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Erreur serveur",
    });
  });

  return app;
}

const app = createApp();
export default app;
