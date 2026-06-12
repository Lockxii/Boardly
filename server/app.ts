import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

function getAppOrigin() {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:5173";
}

function sessionCookieOptions() {
  return {
    httpOnly: false,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  };
}

async function getSessionUser(req: express.Request) {
  const token = (req.cookies?.["better-auth.session_token"] as string) || undefined;
  if (!token) return null;
  const session = await prisma.session.findUnique({ where: { token }, include: { user: true } });
  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
}

function requireAuth(handler: (req: express.Request, res: express.Response, user: any) => Promise<any>) {
  return async (req: express.Request, res: express.Response) => {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: "Non autorisé" });
    return handler(req, res, user);
  };
}

export function createApp() {
  const app = express();
  const origin = getAppOrigin();

  app.use(cors({ origin, credentials: true }));
  app.use(express.json({ limit: "50mb" }));
  app.use(cookieParser());

  // --- AUTH ROUTES ---

  app.post("/api/auth/sign-up", async (req, res) => {
    try {
      const { email, password, name } = req.body;
      if (!email || !password || !name) return res.status(400).json({ error: "Champs manquants" });

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) return res.status(400).json({ error: "Cet email est déjà utilisé" });

      const hashedPassword = crypto.createHash("sha256").update(password).digest("hex");
      const user = await prisma.user.create({
        data: {
          email,
          name,
          emailVerified: true,
          accounts: {
            create: {
              accountId: email,
              providerId: "credential",
              password: hashedPassword,
            },
          },
        },
      });

      const token = crypto.randomUUID() + crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await prisma.session.create({
        data: { userId: user.id, token, expiresAt },
      });

      res.cookie("better-auth.session_token", token, sessionCookieOptions());
      res.json({ id: user.id, name: user.name, email: user.email, image: user.image });
    } catch (e: any) {
      console.error("Sign-up error:", e);
      res.status(500).json({ error: e.message || "Erreur serveur" });
    }
  });

  app.post("/api/auth/sign-in", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: "Champs manquants" });

      const user = await prisma.user.findUnique({ where: { email }, include: { accounts: true } });
      if (!user) return res.status(400).json({ error: "Email ou mot de passe incorrect" });

      const hashedPassword = crypto.createHash("sha256").update(password).digest("hex");
      const account = user.accounts.find((a: any) => a.password === hashedPassword);
      if (!account) return res.status(400).json({ error: "Email ou mot de passe incorrect" });

      const token = crypto.randomUUID() + crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await prisma.session.create({
        data: { userId: user.id, token, expiresAt },
      });

      res.cookie("better-auth.session_token", token, sessionCookieOptions());
      res.json({ id: user.id, name: user.name, email: user.email, image: user.image });
    } catch (e: any) {
      console.error("Sign-in error:", e);
      res.status(500).json({ error: e.message || "Erreur serveur" });
    }
  });

  app.post("/api/auth/sign-out", async (req, res) => {
    const token = (req.cookies?.["better-auth.session_token"] as string) || undefined;
    if (token) {
      await prisma.session.deleteMany({ where: { token } });
    }
    res.clearCookie("better-auth.session_token");
    res.json({ success: true });
  });

  app.get("/api/auth/me", async (req, res) => {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json(null);
    res.json({ id: user.id, name: user.name, email: user.email, image: user.image });
  });

  app.put("/api/auth/user", requireAuth(async (req, res, user) => {
    const { name } = req.body;
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { name },
    });
    res.json({ id: updated.id, name: updated.name, email: updated.email, image: updated.image });
  }));

  app.put("/api/auth/password", requireAuth(async (req, res, user) => {
    const { currentPassword, newPassword } = req.body;
    const hashed = crypto.createHash("sha256").update(currentPassword).digest("hex");
    const account = await prisma.account.findFirst({ where: { userId: user.id, password: hashed } });
    if (!account) return res.status(400).json({ error: "Mot de passe actuel incorrect" });
    const newHashed = crypto.createHash("sha256").update(newPassword).digest("hex");
    await prisma.account.update({ where: { id: account.id }, data: { password: newHashed } });
    res.json({ success: true });
  }));

  // --- BOARD ROUTES ---

  app.get("/api/boards", requireAuth(async (req, res, user) => {
    const boards = await prisma.board.findMany({
      where: { authorId: user.id },
      orderBy: { updatedAt: "desc" },
    });
    res.json(boards);
  }));

  app.post("/api/boards", requireAuth(async (req, res, user) => {
    const { title = "Untitled Board", template = "blank" } = req.body;
    const board = await prisma.board.create({
      data: { title, template, authorId: user.id },
    });
    res.json(board);
  }));

  app.delete("/api/boards/:id", requireAuth(async (req, res, user) => {
    const boardId = String(req.params.id);
    const board = await prisma.board.findUnique({ where: { id: boardId } });
    if (!board || board.authorId !== user.id) return res.status(403).json({ error: "Non autorisé" });
    await prisma.board.delete({ where: { id: boardId } });
    res.json({ success: true });
  }));

  app.get("/api/boards/:id", requireAuth(async (req, res, user) => {
    const boardId = String(req.params.id);
    const board = await prisma.board.findUnique({ where: { id: boardId } });
    if (!board) return res.status(404).json({ error: "Tableau introuvable" });
    const isAuthor = board.authorId === user.id;
    let isMember = false;
    try {
      const member = await prisma.boardMember.findFirst({
        where: { boardId, email: user.email as string },
      });
      isMember = !!member;
    } catch {}
    if (!isAuthor && !isMember) return res.status(403).json({ error: "Accès refusé" });
    res.json(board);
  }));

  app.put("/api/boards/:id/title", requireAuth(async (req, res, user) => {
    const boardId = String(req.params.id);
    const { title } = req.body;
    const board = await prisma.board.findUnique({ where: { id: boardId } });
    if (!board || board.authorId !== user.id) return res.status(403).json({ error: "Non autorisé" });
    const updated = await prisma.board.update({ where: { id: boardId }, data: { title } });
    res.json(updated);
  }));

  // --- MEMBERS ROUTES ---

  app.get("/api/boards/:id/members", requireAuth(async (req, res) => {
    const boardId = String(req.params.id);
    const members = await prisma.boardMember.findMany({ where: { boardId } });
    res.json(members);
  }));

  app.post("/api/boards/:id/invite", requireAuth(async (req, res) => {
    const boardId = String(req.params.id);
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email requis" });
    try {
      await prisma.boardMember.upsert({
        where: { boardId_email: { boardId, email } },
        update: {},
        create: { boardId, email, role: "editor" },
      });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Erreur lors de l'invitation" });
    }
  }));

  app.delete("/api/boards/:id/members/:email", requireAuth(async (req, res, user) => {
    const boardId = String(req.params.id);
    const email = String(req.params.email);
    const board = await prisma.board.findUnique({ where: { id: boardId } });
    if (!board || board.authorId !== user.id) return res.status(403).json({ error: "Seul le créateur peut retirer des membres" });
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
    } catch (e: any) {
      console.error("Liveblocks auth error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  return app;
}

const app = createApp();
export default app;
