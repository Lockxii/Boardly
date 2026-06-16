import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { randomBytes } from "crypto";
import { existsSync } from "fs";
import path from "path";
import { Readable } from "stream";
import type { ReadableStream as WebReadableStream } from "stream/web";
import { fileURLToPath } from "url";
import { Liveblocks } from "@liveblocks/node";
import { get as getBlob, put as putBlob } from "@vercel/blob";
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
import { getAppOrigin } from "./origin.js";
import {
  TWITTER_BOARD_TEMPLATE,
  TWITTER_BOARD_TITLE,
  TWITTER_PROVIDER_ID,
  base64Url,
  buildTwitterBookmarksCanvas,
  codeChallengeFromVerifier,
  fetchTwitterBookmarks,
  findTwitterAccount,
  getTwitterClientId,
  getTwitterRedirectUri,
  isTwitterConfigured,
  twitterTokenRequest,
} from "./integrations/twitter.js";
import {
  ALLOWED_UPLOAD_MIMES,
  MAX_UPLOAD_BYTES,
  ValidationError,
  boardContentSchema,
  boardCreateSchema,
  boardPatchSchema,
  boardTitleSchema,
  joinSchema,
  parseOrThrow,
  uploadSchema,
} from "./validation.js";

/** Unguessable per-board invite secret embedded in collaboration links. */
function generateShareToken() {
  return nanoid(24);
}

/** Sanitize a filename for use in a Content-Disposition header. */
function sanitizeFilename(name: string) {
  return name.replace(/[^\w.\- ]+/g, "_").slice(0, 100) || "file";
}

function filenameExtension(name: string, mime: string) {
  const cleanName = name.toLowerCase().split("?")[0];
  const existing = cleanName.match(/\.([a-z0-9]{1,8})$/)?.[1];
  if (existing) return existing;
  switch (mime) {
    case "image/jpeg": return "jpg";
    case "image/png": return "png";
    case "image/webp": return "webp";
    case "image/gif": return "gif";
    case "audio/webm": return "webm";
    case "audio/ogg": return "ogg";
    case "audio/mpeg": return "mp3";
    case "audio/mp4": return "m4a";
    case "audio/wav": return "wav";
    default: return "bin";
  }
}

function makeBlobPath({
  boardId,
  userId,
  name,
  mime,
}: {
  boardId: string | null;
  userId: string;
  name: string;
  mime: string;
}) {
  const scope = boardId ? `boards/${boardId}` : `users/${userId}`;
  const base = sanitizeFilename(name).replace(/\.[a-z0-9]{1,8}$/i, "") || "upload";
  return `${scope}/${Date.now()}-${base}.${filenameExtension(name, mime)}`;
}

function blobStorageConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || (process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN));
}

/**
 * Parse a base64 data URL into its MIME (params like ";codecs=opus" stripped)
 * and raw base64 body. Robust to media-type parameters (e.g. audio/webm).
 */
function parseDataUrl(value: string): { mime: string; base64: string } | null {
  if (!value.startsWith("data:")) return null;
  const comma = value.indexOf(",");
  if (comma < 0) return null;
  const meta = value.slice(5, comma);
  if (!/;base64$/i.test(meta)) return null;
  const mime = meta.replace(/;base64$/i, "").split(";")[0].trim().toLowerCase();
  return { mime, base64: value.slice(comma + 1) };
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getLiveblocksSecret() {
  return process.env.LIVEBLOCKS_SECRET_KEY || process.env.LIVEBLOCKS_SECRET;
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
      if (res.headersSent) return;
      if (error instanceof ValidationError) {
        return res.status(error.status).json({ error: error.message });
      }
      console.error(`API ${req.method} ${req.path}:`, error);
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
    shareToken?: string | null;
    rev?: number;
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
    rev: board.rev ?? 0,
    // The invite secret is only ever disclosed to the board owner.
    shareToken: meta.isOwner ? board.shareToken ?? null : undefined,
    createdAt: board.createdAt,
    updatedAt: board.updatedAt,
    role: meta.role,
    isOwner: meta.isOwner,
    authorName: board.author?.name ?? null,
  };
}

function serializePublicCanvasData(canvasData: Prisma.JsonValue | null) {
  if (!canvasData || typeof canvasData !== "object" || Array.isArray(canvasData)) return null;
  const data = canvasData as Record<string, unknown>;
  return {
    layers: data.layers && typeof data.layers === "object" && !Array.isArray(data.layers) ? data.layers : {},
    layerIds: Array.isArray(data.layerIds) ? data.layerIds.filter((id) => typeof id === "string") : [],
    connections: Array.isArray(data.connections) ? data.connections : [],
    brandColors: Array.isArray(data.brandColors) ? data.brandColors.filter((color) => typeof color === "string") : [],
  };
}

/** Lazily backfill (and persist) a share token for boards created before the feature existed. */
async function ensureShareToken(board: { id: string; shareToken: string | null }): Promise<string> {
  if (board.shareToken) return board.shareToken;
  const shareToken = generateShareToken();
  await prisma.board.update({ where: { id: board.id }, data: { shareToken } });
  board.shareToken = shareToken;
  return shareToken;
}

export function createApp() {
  const app = express();
  const origin = getAppOrigin();

  // Trust the Vercel/proxy hop so rate-limit keys on the real client IP.
  app.set("trust proxy", 1);

  app.use(cors({ origin, credentials: true }));

  // Rate limiters. NOTE: the default store is in-memory, so on serverless these
  // are per-instance — a meaningful mitigation, not a global guarantee. Better
  // Auth additionally rate-limits credential endpoints (see auth.ts).
  const makeLimiter = (windowMs: number, max: number) =>
    rateLimit({ windowMs, max, standardHeaders: true, legacyHeaders: false });
  const authLimiter = makeLimiter(15 * 60 * 1000, 50); // sign-in/up bursts
  const aiLimiter = makeLimiter(5 * 60 * 1000, 40);
  const previewLimiter = makeLimiter(5 * 60 * 1000, 120);
  const uploadLimiter = makeLimiter(5 * 60 * 1000, 60);

  app.use(["/api/auth/sign-in", "/api/auth/sign-up"], authLimiter);

  // Better Auth must be mounted before express.json()
  app.all("/api/auth/*splat", toNodeHandler(auth));

  // Bounded body size: large enough for a capped canvas payload + thumbnail,
  // far below the previous 50mb that enabled DB-bloat DoS.
  app.use(express.json({ limit: "16mb" }));

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

    // Only the fields serializeBoard needs — never the multi-MB canvasData blob.
    const listSelect = {
      id: true,
      title: true,
      authorId: true,
      template: true,
      thumbnail: true,
      folder: true,
      tags: true,
      isPublic: true,
      shareToken: true,
      rev: true,
      createdAt: true,
      updatedAt: true,
    } satisfies Prisma.BoardSelect;

    const [ownedBoards, sharedBoards] = await Promise.all([
      prisma.board.findMany({
        where: { authorId: user.id },
        orderBy: { updatedAt: "desc" },
        select: listSelect,
      }),
      prisma.board.findMany({
        where: {
          authorId: { not: user.id },
          members: { some: { email } },
        },
        orderBy: { updatedAt: "desc" },
        select: { ...listSelect, author: { select: { name: true } } },
      }),
    ]);

    res.json([
      ...ownedBoards.map((board) => serializeBoard(board, { role: "owner", isOwner: true })),
      ...sharedBoards.map((board) => serializeBoard(board, { role: "editor", isOwner: false })),
    ]);
  }));

  app.post("/api/boards", requireAuth(async (req, res, user) => {
    const { title = "Untitled Board", template = "blank" } = parseOrThrow(boardCreateSchema, req.body);
    const seed = buildTemplateCanvas(template);
    const board = await prisma.board.create({
      data: {
        title,
        template,
        authorId: user.id,
        shareToken: generateShareToken(),
        canvasData: seed ?? undefined,
      },
    });
    res.json(serializeBoard(board, { role: "owner", isOwner: true }));
  }));

  app.get("/api/link-preview", previewLimiter, requireAuth(async (req, res) => {
    const url = String(req.query.url || "");
    if (!url) return res.status(400).json({ error: "URL requise" });
    try {
      const preview = await fetchLinkPreview(url);
      res.json(preview);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Preview impossible" });
    }
  }));

  app.get("/api/music-preview", previewLimiter, requireAuth(async (req, res) => {
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

  app.post("/api/fred/chat", aiLimiter, requireAuth(async (req, res, user) => {
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

  app.post("/api/fred/chat/stream", aiLimiter, requireAuth(async (req, res, user) => {
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
      canvasData: serializePublicCanvasData(board.canvasData),
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
    // The owner needs the invite token to build a collaboration link.
    if (access.isOwner) await ensureShareToken(access.board);
    res.json(serializeBoard(access.board, { role: access.role, isOwner: access.isOwner }));
  }));

  app.put("/api/boards/:id/title", requireAuth(async (req, res, user) => {
    const boardId = String(req.params.id);
    const { title } = parseOrThrow(boardTitleSchema, req.body);
    const access = await getBoardAccess(boardId, user as { id: string; email: string });
    if (!access?.isOwner) return res.status(403).json({ error: "Seul le créateur peut renommer ce tableau" });
    const updated = await prisma.board.update({ where: { id: boardId }, data: { title } });
    res.json(serializeBoard(updated, { role: access.role, isOwner: access.isOwner }));
  }));

  app.patch("/api/boards/:id", requireAuth(async (req, res, user) => {
    const boardId = String(req.params.id);
    const access = await getBoardAccess(boardId, user as { id: string; email: string });
    if (!access?.isOwner) return res.status(403).json({ error: "Seul le créateur peut modifier ce tableau" });
    const { folder, tags, isPublic } = parseOrThrow(boardPatchSchema, req.body);
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
      rev: access.board.rev,
    });
  }));

  app.put("/api/boards/:id/content", requireAuth(async (req, res, user) => {
    const boardId = String(req.params.id);
    const access = await getBoardAccess(boardId, user as { id: string; email: string });
    if (!access) return res.status(403).json({ error: "Accès refusé" });

    const { canvasData, thumbnail, baseRev } = parseOrThrow(boardContentSchema, req.body);
    const data = {
      canvasData: canvasData as unknown as Prisma.InputJsonValue,
      thumbnail: typeof thumbnail === "string" ? thumbnail : access.board.thumbnail,
      rev: { increment: 1 },
    };

    // Optimistic concurrency: if the client tells us which revision it edited
    // from, only write when the board hasn't advanced underneath it. This stops
    // a stale tab from silently clobbering a collaborator's changes.
    if (typeof baseRev === "number") {
      const result = await prisma.board.updateMany({
        where: { id: boardId, rev: baseRev },
        data,
      });
      if (result.count === 0) {
        const current = await prisma.board.findUnique({
          where: { id: boardId },
          select: { rev: true, updatedAt: true },
        });
        return res.status(409).json({
          error: "conflict",
          rev: current?.rev ?? access.board.rev,
          updatedAt: current?.updatedAt ?? access.board.updatedAt,
        });
      }
      const updated = await prisma.board.findUnique({
        where: { id: boardId },
        select: { rev: true, updatedAt: true, thumbnail: true },
      });
      return res.json({
        success: true,
        rev: updated?.rev,
        updatedAt: updated?.updatedAt,
        thumbnail: updated?.thumbnail,
      });
    }

    const updated = await prisma.board.update({ where: { id: boardId }, data });
    res.json({
      success: true,
      rev: updated.rev,
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
    const { inviteToken } = parseOrThrow(joinSchema, req.body ?? {});
    const board = await prisma.board.findUnique({
      where: { id: boardId },
      select: { id: true, authorId: true, shareToken: true },
    });
    if (!board) return res.status(404).json({ error: "Tableau introuvable" });

    const authUser = user as { id: string; email: string };
    if (!authUser.email) return res.status(400).json({ error: "Email utilisateur manquant" });
    if (board.authorId === authUser.id) {
      return res.json({ success: true, role: "owner" });
    }

    // Already a member? Idempotently confirm — no token needed to re-open a link.
    const existing = await prisma.boardMember.findUnique({
      where: { boardId_email: { boardId, email: authUser.email } },
    });
    if (existing) {
      return res.json({ success: true, role: existing.role === "owner" ? "owner" : "editor" });
    }

    // Otherwise require a valid, owner-issued invite token. Knowing the board id
    // (which leaks via public links/logs) is NOT sufficient to gain access.
    if (!board.shareToken || !inviteToken || inviteToken !== board.shareToken) {
      return res.status(403).json({ error: "Invitation invalide ou expirée" });
    }

    await prisma.boardMember.create({
      data: { boardId, email: authUser.email, role: "editor" },
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

  app.post("/api/upload", uploadLimiter, requireAuth(async (req, res, user) => {
    await ensureBoardSchema();
    const { name, type, size, data, boardId } = parseOrThrow(uploadSchema, req.body);

    let attachmentBoardId: string | null = null;
    if (boardId) {
      const access = await getBoardAccess(boardId, user as { id: string; email: string });
      if (!access) return res.status(403).json({ error: "Accès refusé" });
      attachmentBoardId = boardId;
    }

    // Resolve the real MIME + raw base64 from either a data URL or raw bytes.
    const parsed = parseDataUrl(data);
    const mime = (parsed ? parsed.mime : type.split(";")[0]).trim().toLowerCase();
    const base64 = parsed ? parsed.base64 : data;

    if (!ALLOWED_UPLOAD_MIMES.has(mime)) {
      return res.status(415).json({ error: "Type de fichier non autorisé" });
    }
    const bytes = Buffer.byteLength(base64, "base64");
    if (bytes > MAX_UPLOAD_BYTES) {
      return res.status(413).json({ error: "Fichier trop volumineux" });
    }

    const buffer = Buffer.from(base64, "base64");
    const blobEnabled = blobStorageConfigured();
    const blob = blobEnabled
      ? await putBlob(
          makeBlobPath({ boardId: attachmentBoardId, userId: user.id, name, mime }),
          buffer,
          {
            access: "private",
            addRandomSuffix: true,
            contentType: mime,
          },
        )
      : null;

    const attachment = await prisma.chatAttachment.create({
      data: {
        name: name || "image",
        type: mime,
        size: size ?? bytes,
        data: blob ? null : data,
        storageProvider: blob ? "vercel_blob" : "database",
        url: blob?.url ?? null,
        pathname: blob?.pathname ?? null,
        boardId: attachmentBoardId,
        userId: user.id,
      },
    });
    res.json({ url: `/api/file/${attachment.id}`, id: attachment.id });
  }));

  app.get("/api/file/:fileId", async (req, res) => {
    try {
      await ensureBoardSchema();
      const fileId = String(req.params.fileId);
      const attachment = await prisma.chatAttachment.findUnique({
        where: { id: fileId },
        include: { board: { select: { isPublic: true } } },
      });
      if (!attachment) return res.status(404).json({ error: "Not found" });

      if (attachment.boardId) {
        if (!attachment.board?.isPublic) {
          const user = await getSessionUser(req);
          if (!user) return res.status(401).json({ error: "Non autorisé" });
          const access = await getBoardAccess(attachment.boardId, user as { id: string; email: string });
          if (!access) return res.status(403).json({ error: "Accès refusé" });
        }
      } else {
        const user = await getSessionUser(req);
        if (!user) return res.status(401).json({ error: "Non autorisé" });
      }

      const rawMime = (attachment.type || "").split(";")[0].trim().toLowerCase();

      // Only serve known-safe image/audio types inline. Anything else is forced
      // to a download with a neutral content-type, and nosniff prevents browser
      // re-interpretation as HTML/script.
      const safeMime = ALLOWED_UPLOAD_MIMES.has(rawMime) ? rawMime : "application/octet-stream";
      res.setHeader("Content-Type", safeMime);
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader(
        "Content-Disposition",
        `${safeMime === "application/octet-stream" ? "attachment" : "inline"}; filename="${sanitizeFilename(attachment.name)}"`,
      );

      if (attachment.storageProvider === "vercel_blob" && (attachment.pathname || attachment.url)) {
        const ifNoneMatch = typeof req.headers["if-none-match"] === "string" ? req.headers["if-none-match"] : undefined;
        const range = typeof req.headers.range === "string" ? req.headers.range : undefined;
        const result = await getBlob(attachment.pathname || attachment.url!, {
          access: "private",
          ifNoneMatch,
          headers: range ? { Range: range } : undefined,
        });
        if (!result) return res.status(404).json({ error: "Not found" });
        if (result.statusCode === 304) {
          if (result.blob.etag) res.setHeader("ETag", result.blob.etag);
          return res.status(304).end();
        }
        const upstreamStatus = result.headers.get("content-range") ? 206 : 200;
        const contentLength = result.headers.get("content-length");
        const contentRange = result.headers.get("content-range");
        const acceptRanges = result.headers.get("accept-ranges");
        if (contentLength) res.setHeader("Content-Length", contentLength);
        if (contentRange) res.setHeader("Content-Range", contentRange);
        if (acceptRanges) res.setHeader("Accept-Ranges", acceptRanges);
        if (result.blob.etag) res.setHeader("ETag", result.blob.etag);
        res.setHeader("Cache-Control", "private, max-age=0, must-revalidate");
        res.status(upstreamStatus);
        return Readable.fromWeb(result.stream as unknown as WebReadableStream<Uint8Array>).pipe(res);
      }

      if (!attachment.data) return res.status(404).json({ error: "Not found" });
      const parsed = parseDataUrl(attachment.data);
      const buffer = Buffer.from(parsed ? parsed.base64 : attachment.data, "base64");
      res.send(buffer);
    } catch (error) {
      console.error(`API ${req.method} ${req.path}:`, error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Erreur serveur",
      });
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
