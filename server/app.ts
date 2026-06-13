import express from "express";
import cors from "cors";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Liveblocks } from "@liveblocks/node";
import { toNodeHandler, fromNodeHeaders } from "better-auth/node";
import { auth } from "./auth.js";
import { prisma } from "./prisma.js";
import { ensureBoardSchema } from "./schema-sync.js";
import { fetchLinkPreview } from "./link-preview.js";
import { fetchMusicPreviewHandler } from "./music-preview.js";
import { buildTemplateCanvas } from "./board-seeds.js";
import { chatWithFred, isFredConfigured, streamChatWithFred } from "./fred-ai.js";
import { getBoardAccess } from "./board-access.js";

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
        template: access.board.template,
        authorId: user.id,
        canvasData: access.board.canvasData ?? undefined,
        thumbnail: access.board.thumbnail,
        folder: access.board.folder,
        tags: access.board.tags,
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
