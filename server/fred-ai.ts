import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

const FRED_MODEL = process.env.FRED_AI_MODEL || "gemini-2.0-flash";

const FredActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("add_notes"),
    items: z.array(z.string().min(1).max(500)).max(8),
  }),
  z.object({
    type: z.literal("add_text"),
    items: z.array(z.string().min(1).max(500)).max(6),
  }),
]);

const FredResponseSchema = z.object({
  reply: z.string().min(1),
  actions: z.array(FredActionSchema).max(4).optional().default([]),
});

export type FredAction = z.infer<typeof FredActionSchema>;
export type FredChatMessage = { role: "user" | "assistant"; content: string };

export type BoardContextPayload = {
  title?: string;
  template?: string;
  layerCount?: number;
  selectionCount?: number;
  summary?: string;
};

const SYSTEM_PROMPT = `Tu es Fred, l'assistant IA intégré à Boardly — un canvas infini pour moodboards, refs visuelles et brainstorm.

Personnalité : créatif, direct, bienveillant. Tu tutoies l'utilisateur. Réponds en français.

Tu reçois parfois un résumé du tableau (éléments, liens, notes). Utilise-le pour des réponses concrètes.

Quand l'utilisateur demande d'ajouter des idées, post-its, notes ou titres sur le canvas, propose des actions.
Sinon, laisse "actions" vide.

Réponds UNIQUEMENT en JSON valide, sans markdown autour :
{
  "reply": "ta réponse (markdown léger autorisé dans la string)",
  "actions": []
}

Actions autorisées :
- { "type": "add_notes", "items": ["note 1", "note 2"] } — post-its jaunes (max 8)
- { "type": "add_text", "items": ["titre ou label"] } — blocs texte (max 6)

Ne invente pas d'autres types d'actions.`;

function getClient() {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("Fred AI n'est pas configuré (GOOGLE_AI_API_KEY manquante)");
  }
  return new GoogleGenerativeAI(apiKey);
}

function buildContextBlock(context?: BoardContextPayload) {
  if (!context) return "";
  const lines: string[] = ["--- Contexte du tableau ---"];
  if (context.title) lines.push(`Titre : ${context.title}`);
  if (context.template) lines.push(`Modèle : ${context.template}`);
  if (typeof context.layerCount === "number") lines.push(`Éléments : ${context.layerCount}`);
  if (typeof context.selectionCount === "number" && context.selectionCount > 0) {
    lines.push(`Sélection : ${context.selectionCount} élément(s)`);
  }
  if (context.summary) lines.push(`Contenu :\n${context.summary}`);
  lines.push("--- Fin contexte ---");
  return lines.join("\n");
}

function parseFredResponse(raw: string) {
  const trimmed = raw.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  const candidate = jsonMatch ? jsonMatch[0] : trimmed;
  const parsed = JSON.parse(candidate);
  return FredResponseSchema.parse(parsed);
}

export async function chatWithFred(input: {
  message: string;
  history?: FredChatMessage[];
  boardContext?: BoardContextPayload;
}) {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({
    model: FRED_MODEL,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2048,
      responseMimeType: "application/json",
    },
  });

  const contextBlock = buildContextBlock(input.boardContext);
  const history = (input.history ?? []).slice(-10);

  const contents: { role: "user" | "model"; parts: { text: string }[] }[] = [];

  for (const msg of history) {
    contents.push({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    });
  }

  let userText = input.message.trim();
  if (contextBlock && history.length === 0) {
    userText = `${contextBlock}\n\nMessage utilisateur :\n${userText}`;
  }

  contents.push({ role: "user", parts: [{ text: userText }] });

  const result = await model.generateContent({ contents });
  const text = result.response.text();

  try {
    return parseFredResponse(text);
  } catch {
    return {
      reply: text || "Je n'ai pas pu formuler une réponse claire. Réessaie.",
      actions: [] as FredAction[],
    };
  }
}

export function isFredConfigured() {
  return !!process.env.GOOGLE_AI_API_KEY;
}
