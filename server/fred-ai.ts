import { GoogleGenerativeAI, type Part } from "@google/generative-ai";
import { z } from "zod";
import { resolveVisionAssets, type VisionAssetInput } from "./fred-vision.js";

const FRED_MODEL = process.env.FRED_AI_MODEL || "gemini-2.0-flash";

const NoteItemSchema = z.union([
  z.string().min(1).max(500),
  z.object({
    text: z.string().min(1).max(500),
    color: z.string().max(32).optional(),
  }),
]);

const FredActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("add_notes"),
    items: z.array(NoteItemSchema).max(8),
  }),
  z.object({
    type: z.literal("add_text"),
    items: z.array(z.string().min(1).max(500)).max(6),
  }),
  z.object({
    type: z.literal("add_frames"),
    items: z
      .array(
        z.object({
          title: z.string().min(1).max(80),
          notes: z.array(z.string().min(1).max(300)).max(5).optional(),
        })
      )
      .max(3),
  }),
]);

const FredResponseSchema = z.object({
  reply: z.string().min(1),
  actions: z.array(FredActionSchema).max(5).optional().default([]),
});

export type FredAction = z.infer<typeof FredActionSchema>;
export type FredChatMessage = { role: "user" | "assistant"; content: string };

export type BoardContextPayload = {
  title?: string;
  template?: string;
  layerCount?: number;
  selectionCount?: number;
  summary?: string;
  visionAttached?: boolean;
  visionCount?: number;
};

const SYSTEM_PROMPT = `Tu es Fred, l'assistant IA intégré à Boardly — canvas infini pour moodboards et refs visuelles.

Personnalité : créatif, direct, bienveillant. Tu tutoies. Réponds en français.

RÈGLES DE CONTEXTE (important) :
- Base-toi UNIQUEMENT sur le résumé texte et les images fournies. N'invente pas de contenu absent.
- Si une image est floue, cropée ou illisible, dis-le clairement au lieu de deviner.
- Si tu n'as pas assez d'info, pose une question courte ou propose une action prudente.
- Ne répète pas tout le résumé du board : va à l'essentiel.

VISION : quand des images sont jointes, décris palette, style, composition, mood, éléments utiles pour un moodboard.

GÉNÉRATION SUR LE CANVAS : quand l'utilisateur demande des idées, post-its, sections ou titres, propose des actions JSON.
Sinon laisse "actions" vide.

Réponds UNIQUEMENT en JSON valide :
{
  "reply": "ta réponse (markdown léger autorisé)",
  "actions": []
}

Actions autorisées :
- { "type": "add_notes", "items": ["note"] } ou items avec { "text": "...", "color": "#FEF3C7" }
- { "type": "add_text", "items": ["titre"] }
- { "type": "add_frames", "items": [{ "title": "Section", "notes": ["idée 1"] }] } — cadres avec post-its (max 3 sections)

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
  if (context.visionAttached) {
    lines.push(`Images jointes à ce message : ${context.visionCount ?? 1} (analyse visuelle disponible)`);
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

function buildVisionParts(assets: { label: string; mimeType: string; data: string }[]): Part[] {
  const parts: Part[] = [];
  for (const asset of assets) {
    parts.push({ text: `[Image: ${asset.label}]` });
    parts.push({ inlineData: { mimeType: asset.mimeType, data: asset.data } });
  }
  return parts;
}

export async function chatWithFred(input: {
  message: string;
  history?: FredChatMessage[];
  boardContext?: BoardContextPayload;
  visionAssets?: VisionAssetInput[];
}) {
  const { assets: resolvedVision, skipped } = await resolveVisionAssets(input.visionAssets);

  const enrichedContext: BoardContextPayload | undefined = input.boardContext
    ? {
        ...input.boardContext,
        visionAttached: resolvedVision.length > 0,
        visionCount: resolvedVision.length,
      }
    : resolvedVision.length > 0
      ? { visionAttached: true, visionCount: resolvedVision.length }
      : undefined;

  const genAI = getClient();
  const model = genAI.getGenerativeModel({
    model: FRED_MODEL,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      temperature: 0.65,
      maxOutputTokens: 2048,
      responseMimeType: "application/json",
    },
  });

  const contextBlock = buildContextBlock(enrichedContext);
  const history = (input.history ?? []).slice(-8);

  const contents: { role: "user" | "model"; parts: Part[] }[] = [];

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

  const userParts: Part[] = [{ text: userText }, ...buildVisionParts(resolvedVision)];

  contents.push({ role: "user", parts: userParts });

  const result = await model.generateContent({ contents });
  const text = result.response.text();

  try {
    const parsed = parseFredResponse(text);
    return {
      ...parsed,
      meta: {
        visionUsed: resolvedVision.length,
        visionSkipped: skipped,
      },
    };
  } catch {
    return {
      reply: text || "Je n'ai pas pu formuler une réponse claire. Réessaie.",
      actions: [] as FredAction[],
      meta: { visionUsed: resolvedVision.length, visionSkipped: skipped },
    };
  }
}

export function isFredConfigured() {
  return !!process.env.GOOGLE_AI_API_KEY;
}
