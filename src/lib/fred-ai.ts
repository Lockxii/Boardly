import { apiFetch } from "@/lib/utils";
import type { FredVisionAssetPayload, FredVisionMode } from "@/lib/fred-vision";

export type FredNoteItem = string | { text: string; color?: string };

export type FredAction =
  | { type: "add_notes"; items: FredNoteItem[] }
  | { type: "add_text"; items: string[] }
  | { type: "add_frames"; items: { title: string; notes?: string[] }[] };

export type FredChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions?: FredAction[];
  pending?: boolean;
  meta?: { visionUsed?: number };
};

export type BoardContextPayload = {
  title?: string;
  template?: string;
  layerCount?: number;
  selectionCount?: number;
  visionCount?: number;
  summary?: string;
};

export type FredChatResponse = {
  reply: string;
  actions: FredAction[];
  meta?: { visionUsed?: number; visionSkipped?: number };
};

export async function sendFredMessage(input: {
  message: string;
  history: { role: "user" | "assistant"; content: string }[];
  boardContext?: BoardContextPayload;
  boardId?: string;
  visionMode?: FredVisionMode;
  visionAssets?: FredVisionAssetPayload[];
}) {
  return apiFetch<FredChatResponse>("/api/fred/chat", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function fetchFredStatus() {
  return apiFetch<{ configured: boolean }>("/api/fred/status");
}
