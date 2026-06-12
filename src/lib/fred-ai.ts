import { apiFetch } from "@/lib/utils";

export type FredAction =
  | { type: "add_notes"; items: string[] }
  | { type: "add_text"; items: string[] };

export type FredChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions?: FredAction[];
  pending?: boolean;
};

export type BoardContextPayload = {
  title?: string;
  template?: string;
  layerCount?: number;
  selectionCount?: number;
  summary?: string;
};

export type FredChatResponse = {
  reply: string;
  actions: FredAction[];
};

export async function sendFredMessage(input: {
  message: string;
  history: { role: "user" | "assistant"; content: string }[];
  boardContext?: BoardContextPayload;
  boardId?: string;
}) {
  return apiFetch<FredChatResponse>("/api/fred/chat", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function fetchFredStatus() {
  return apiFetch<{ configured: boolean }>("/api/fred/status");
}
