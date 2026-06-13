import { apiFetch } from "@/lib/utils";
import type { FredVisionAssetPayload } from "@/lib/fred-vision";

export type FredNoteItem = string | { text: string; color?: string };
export type FredActionTarget = "linked" | "selection" | "all";

export type FredAction =
  | { type: "add_notes"; items: FredNoteItem[] }
  | { type: "add_text"; items: string[] }
  | { type: "add_frames"; items: { title: string; notes?: string[] }[] }
  | { type: "add_links"; items: { url: string; title?: string; description?: string }[] }
  | {
      type: "add_comments";
      target?: FredActionTarget;
      items: { layerId?: string; targetIndex?: number; text: string }[];
    }
  | {
      type: "organize_layers";
      target?: FredActionTarget;
      layout: "grid" | "row" | "column" | "stack";
      spacing?: number;
    }
  | { type: "set_brand_colors"; colors: string[] }
  | { type: "create_version"; label?: string }
  | { type: "open_presentation" };

export type FredToolMode =
  | "chat"
  | "critique"
  | "palette"
  | "brief"
  | "organize"
  | "pitch"
  | "annotate"
  | "web"
  | "export";

export type FredChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions?: FredAction[];
  linkedLayerIds?: string[];
  pending?: boolean;
  meta?: { visionUsed?: number };
};

export type BoardContextPayload = {
  title?: string;
  template?: string;
  layerCount?: number;
  selectionCount?: number;
  visionCount?: number;
  memory?: string;
  summary?: string;
  linkedSummary?: string;
};

export type FredChatResponse = {
  reply: string;
  actions: FredAction[];
  memory?: string;
  meta?: { visionUsed?: number; visionSkipped?: number };
};

export type FredStreamCallbacks = {
  onDelta: (text: string) => void;
  onDone: (response: FredChatResponse) => void;
};

export async function streamFredMessage(
  input: {
    message: string;
    history: { role: "user" | "assistant"; content: string }[];
    boardContext?: BoardContextPayload;
    boardId?: string;
    linkedLayerIds?: string[];
    visionAssets?: FredVisionAssetPayload[];
    toolMode?: FredToolMode;
  },
  callbacks: FredStreamCallbacks
) {
  const res = await fetch("/api/fred/chat/stream", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `API error ${res.status}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("Streaming non supporté");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      if (!part.trim()) continue;
      const lines = part.split("\n");
      const eventLine = lines.find((l) => l.startsWith("event: "));
      const dataLine = lines.find((l) => l.startsWith("data: "));
      if (!dataLine) continue;

      const eventType = eventLine?.slice(7).trim();
      const payload = JSON.parse(dataLine.slice(6)) as Record<string, unknown>;

      if (eventType === "delta" && typeof payload.text === "string") {
        callbacks.onDelta(payload.text);
      } else if (eventType === "done") {
        callbacks.onDone({
          reply: String(payload.reply ?? ""),
          actions: (payload.actions as FredAction[]) ?? [],
          memory: payload.memory as string | undefined,
          meta: payload.meta as FredChatResponse["meta"],
        });
      } else if (eventType === "error") {
        throw new Error(String(payload.error ?? "Erreur Fred AI"));
      }
    }
  }
}

export async function fetchFredStatus() {
  return apiFetch<{ configured: boolean }>("/api/fred/status");
}
