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

export async function sendFredMessage(input: {
  message: string;
  history: { role: "user" | "assistant"; content: string }[];
  boardContext?: BoardContextPayload;
  boardId?: string;
  linkedLayerIds?: string[];
  visionAssets?: FredVisionAssetPayload[];
  toolMode?: FredToolMode;
}) {
  return apiFetch<FredChatResponse>("/api/fred/chat", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function fetchFredStatus() {
  return apiFetch<{ configured: boolean }>("/api/fred/status");
}
