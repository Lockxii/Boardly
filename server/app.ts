import express from "express";
import cors from "cors";
import { toNodeHandler, fromNodeHeaders } from "better-auth/node";
import { auth } from "./auth.js";
import { prisma } from "./prisma.js";

function getAppOrigin() {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:5173";
}

async function getSessionUser(req: express.Request) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  return session?.user ?? null;
}

function requireAuth(handler: (req: express.Request, res: express.Response, user: NonNullable<Awaited<ReturnType<typeof getSessionUser>>>) => Promise<unknown>) {
  return async (req: express.Request, res: express.Response) => {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: "Non autorisé" });
    return handler(req, res, user);
  };
}

type BoardAccess = {
  board: NonNullable<Awaited<ReturnType<typeof prisma.board.findUnique>>>;
  role: "owner" | "editor";
  isOwner: boolean;
};

async function getBoardAccess(boardId: string, user: { id: string; email: string }): Promise<BoardAccess | null> {
  const board = await prisma.board.findUnique({ where: { id: boardId } });
  if (!board) return null;
  if (board.authorId === user.id) {
    return { board, role: "owner", isOwner: true };
  }
  const member = await prisma.boardMember.findFirst({
    where: { boardId, email: user.email },
  });
  if (!member) return null;
  return { board, role: "editor", isOwner: false };
}

function serializeBoard(
  board: {
    id: string;
    title: string;
    authorId: string;
    template: string;
    thumbnail: string | null;
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

  // --- BOARD ROUTES ---

  app.get("/api/boards", requireAuth(async (req, res, user) => {
    const [ownedBoards, sharedBoards] = await Promise.all([
      prisma.board.findMany({
        where: { authorId: user.id },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.board.findMany({
        where: {
          authorId: { not: user.id },
          members: { some: { email: user.email as string } },
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
    const board = await prisma.board.create({
      data: { title, template, authorId: user.id },
    });
    res.json(serializeBoard(board, { role: "owner", isOwner: true }));
  }));

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

  app.post("/api/boards/:id/invite", requireAuth(async (req, res, user) => {
    const boardId = String(req.params.id);
    const access = await getBoardAccess(boardId, user as { id: string; email: string });
    if (!access?.isOwner) return res.status(403).json({ error: "Seul le créateur peut inviter" });
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email requis" });
    try {
      await prisma.boardMember.upsert({
        where: { boardId_email: { boardId, email } },
        update: {},
        create: { boardId, email, role: "editor" },
      });
      res.json({ success: true });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erreur lors de l'invitation";
      res.status(500).json({ error: message });
    }
  }));

  app.delete("/api/boards/:id/members/:email", requireAuth(async (req, res, user) => {
    const boardId = String(req.params.id);
    const email = decodeURIComponent(String(req.params.email));
    const access = await getBoardAccess(boardId, user as { id: string; email: string });
    if (!access?.isOwner) return res.status(403).json({ error: "Seul le créateur peut retirer des membres" });
    await prisma.boardMember.delete({
      where: { boardId_email: { boardId, email } },
    });
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

  // --- LIVEBLOCKS AUTH ---

  app.post("/api/liveblocks-auth", async (req, res) => {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: "Non autorisé" });

    const room = req.body?.room;
    if (!room) return res.status(400).json({ error: "Room required" });

    const LIVEBLOCKS_SECRET = process.env.LIVEBLOCKS_SECRET_KEY || "";
    if (!LIVEBLOCKS_SECRET) {
      return res.json({
        token: "dev-token",
        actor: user.id,
        userInfo: { name: user.name, picture: user.image },
      });
    }

    try {
      const response = await fetch("https://api.liveblocks.io/v2/rooms/" + room + "/authorize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LIVEBLOCKS_SECRET}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
          userInfo: { name: user.name, picture: user.image },
        }),
      });
      const data = await response.json();
      res.json(data);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Liveblocks error";
      console.error("Liveblocks auth error:", e);
      res.status(500).json({ error: message });
    }
  });

  return app;
}

const app = createApp();
export default app;
