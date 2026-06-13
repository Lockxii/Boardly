import type { FredAction } from "@/lib/fred-ai";

export type FredStoredMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions?: FredAction[];
  linkedLayerIds?: string[];
  meta?: { visionUsed?: number };
};

export type FredChatSession = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: FredStoredMessage[];
};

export type FredPanelLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const WELCOME: FredStoredMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Salut ! Je suis **Fred**. Lie des éléments du canvas avec le bouton 🔗, puis pose-moi une question — j'analyse les images liées et le contexte réel du board.",
};

function chatsKey(boardId: string) {
  return `boardly-fred-chats-${boardId}`;
}

function layoutKey(boardId: string) {
  return `boardly-fred-layout-${boardId}`;
}

function activeKey(boardId: string) {
  return `boardly-fred-active-${boardId}`;
}

export function loadFredSessions(boardId: string): FredChatSession[] {
  if (!boardId) return [createFredSession()];
  try {
    const raw = localStorage.getItem(chatsKey(boardId));
    if (!raw) return [createFredSession()];
    const parsed = JSON.parse(raw) as FredChatSession[];
    return parsed.length ? parsed : [createFredSession()];
  } catch {
    return [createFredSession()];
  }
}

export function saveFredSessions(boardId: string, sessions: FredChatSession[]) {
  if (!boardId) return;
  localStorage.setItem(chatsKey(boardId), JSON.stringify(sessions));
}

export function loadActiveSessionId(boardId: string): string | null {
  if (!boardId) return null;
  return localStorage.getItem(activeKey(boardId));
}

export function saveActiveSessionId(boardId: string, sessionId: string) {
  if (!boardId) return;
  localStorage.setItem(activeKey(boardId), sessionId);
}

export function createFredSession(): FredChatSession {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title: "Nouveau chat",
    createdAt: now,
    updatedAt: now,
    messages: [WELCOME],
  };
}

export function sessionTitleFromMessage(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "Nouveau chat";
  return clean.length > 36 ? `${clean.slice(0, 35)}…` : clean;
}

export function loadFredPanelLayout(boardId: string): FredPanelLayout | null {
  if (!boardId) return null;
  try {
    const raw = localStorage.getItem(layoutKey(boardId));
    return raw ? (JSON.parse(raw) as FredPanelLayout) : null;
  } catch {
    return null;
  }
}

export function saveFredPanelLayout(boardId: string, layout: FredPanelLayout) {
  if (!boardId) return;
  localStorage.setItem(layoutKey(boardId), JSON.stringify(layout));
}

export { WELCOME as FRED_WELCOME_MESSAGE };
