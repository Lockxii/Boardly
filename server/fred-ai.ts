import { GoogleGenerativeAI, type Part } from "@google/generative-ai";
import { z } from "zod";
import { resolveVisionAssets, type VisionAssetInput } from "./fred-vision.js";

const FRED_MODEL = process.env.FRED_AI_MODEL || "gemini-2.5-flash";

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
  z.object({
    type: z.literal("add_links"),
    items: z
      .array(
        z.object({
          url: z.string().url(),
          title: z.string().min(1).max(140).optional(),
          description: z.string().max(300).optional(),
        })
      )
      .max(6),
  }),
  z.object({
    type: z.literal("add_comments"),
    target: z.enum(["linked", "selection", "all"]).optional().default("linked"),
    items: z
      .array(
        z.object({
          layerId: z.string().optional(),
          targetIndex: z.number().int().min(1).optional(),
          text: z.string().min(1).max(500),
        })
      )
      .max(12),
  }),
  z.object({
    type: z.literal("organize_layers"),
    target: z.enum(["linked", "selection", "all"]).optional().default("linked"),
    layout: z.enum(["grid", "row", "column", "stack"]),
    spacing: z.number().min(8).max(180).optional(),
  }),
  z.object({
    type: z.literal("set_brand_colors"),
    colors: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).min(2).max(8),
  }),
  z.object({
    type: z.literal("create_version"),
    label: z.string().min(1).max(80).optional(),
  }),
  z.object({
    type: z.literal("open_presentation"),
  }),
  z.object({
    type: z.literal("update_texts"),
    items: z
      .array(
        z.object({
          id: z.string().min(1),
          text: z.string().min(1).max(2000),
        }),
      )
      .max(40),
  }),
]);

const FredResponseSchema = z.object({
  reply: z.string().min(1),
  actions: z.array(FredActionSchema).max(5).optional().default([]),
  memory: z.string().max(1600).optional(),
});

export type FredAction = z.infer<typeof FredActionSchema>;
export type FredChatMessage = { role: "user" | "assistant"; content: string };
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

export type BoardContextPayload = {
  title?: string;
  template?: string;
  layerCount?: number;
  selectionCount?: number;
  summary?: string;
  linkedSummary?: string;
  visionAttached?: boolean;
  visionCount?: number;
  memory?: string;
};

const SYSTEM_PROMPT = `Tu es Fred, l'assistant IA intégré à Boardly — canvas infini pour moodboards et refs visuelles.

Personnalité : créatif, direct, bienveillant. Tu tutoies. Réponds en français.

RÈGLES DE CONTEXTE (important) :
- Base-toi UNIQUEMENT sur le résumé texte et les images fournies. N'invente pas de contenu absent.
- Si une image est floue, cropée ou illisible, dis-le clairement au lieu de deviner.
- Si tu n'as pas assez d'info, pose une question courte ou propose une action prudente.
- Ne répète pas tout le résumé du board : va à l'essentiel.
- Tiens compte de la mémoire de board si elle est fournie, puis renvoie une mémoire mise à jour courte.

VISION : analyse uniquement les images explicitement jointes au message (éléments liés). N'invente rien sur les images absentes.

GÉNÉRATION SUR LE CANVAS : quand l'utilisateur demande des idées, post-its, sections, titres, annotations, rangement, liens ou présentation, propose des actions JSON.
Sinon laisse "actions" vide.

Réponds UNIQUEMENT en JSON valide :
{
  "reply": "ta réponse (markdown léger autorisé)",
  "actions": [],
  "memory": "résumé stable du board en 3-6 points, ou mémoire existante actualisée"
}

Actions autorisées :
- { "type": "add_notes", "items": ["note"] } ou items avec { "text": "...", "color": "#FEF3C7" }
- { "type": "add_text", "items": ["titre"] }
- { "type": "add_frames", "items": [{ "title": "Section", "notes": ["idée 1"] }] } — cadres avec post-its (max 3 sections)
- { "type": "add_comments", "target": "linked", "items": [{ "layerId": "id exact", "text": "annotation" }] } — annotations sur éléments
- { "type": "organize_layers", "target": "linked", "layout": "grid"|"row"|"column"|"stack", "spacing": 32 }
- { "type": "set_brand_colors", "colors": ["#111111", "#FFFFFF"] }
- { "type": "add_links", "items": [{ "url": "https://...", "title": "...", "description": "..." }] }
- { "type": "create_version", "label": "Avant rangement Fred" }
- { "type": "open_presentation" }
- { "type": "update_texts", "items": [{ "id": "id exact", "text": "nouveau contenu" }] } — réécrit/corrige/traduit le texte d'éléments EXISTANTS (notes, textes). Utilise les ids exacts [id:...] du contexte.

Ne invente pas d'autres types d'actions.
Pour add_comments et update_texts, utilise les ids exacts [id:...] présents dans le contexte.
Quand on te demande de corriger/raccourcir/traduire/réécrire des notes existantes, utilise update_texts (n'ajoute pas de nouvelles notes).`;

const STREAM_SYSTEM_PROMPT = `${SYSTEM_PROMPT}

FORMAT STREAMING :
- Écris d'abord ta réponse visible en markdown français.
- Si des actions canvas sont pertinentes, termine par exactement ce bloc (rien après <<<END>>>) :
<<<ACTIONS>>>
{"actions":[...],"memory":"résumé court ou mémoire actualisée"}
<<<END>>>
- Si aucune action : pas de bloc <<<ACTIONS>>>.`;

const ACTIONS_MARKER = "<<<ACTIONS>>>";
const ACTIONS_END_MARKER = "<<<END>>>";

const MODE_INSTRUCTIONS: Record<FredToolMode, string> = {
  chat: "Mode libre : réponds et propose des actions seulement si utile.",
  critique: "Mode critique créa : évalue cohérence, hiérarchie, lisibilité, direction artistique, risques et prochaines décisions. Sois direct.",
  palette: "Mode analyse visuelle : extrais palette, style, typographies probables, composition et mood. Utilise set_brand_colors si une palette fiable ressort.",
  brief: "Mode brief : transforme le board en brief clair avec contexte, concept, public, messages, livrables et contraintes.",
  organize: "Mode organisation : propose un rangement concret et utilise organize_layers/create_version si des éléments sont ciblables.",
  pitch: "Mode présentation : écris un pitch frame par frame ou section par section. Utilise open_presentation si le board est prêt.",
  annotate: "Mode annotations : crée des commentaires courts et actionnables directement sur les éléments avec add_comments.",
  web: "Mode recherche web : exploite les résultats web fournis, cite les URLs utiles, puis propose éventuellement add_links.",
  export: "Mode export : produis un document Markdown propre et exploitable à partir du board.",
};

type WebResult = { title: string; url: string; snippet?: string };

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
  if (context.memory) lines.push(`Mémoire Fred :\n${context.memory}`);
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
  if (context.linkedSummary) lines.push(context.linkedSummary);
  lines.push("--- Fin contexte ---");
  return lines.join("\n");
}

function shouldSearchWeb(mode: FredToolMode, message: string) {
  if (mode === "web") return true;
  const normalized = message.toLowerCase();
  return (
    /\b(web|cherche|trouve|recherche|refs?|références?|inspirations?|exemples?)\b/.test(normalized) &&
    /\b(site|marque|logo|image|inspi|référence|exemple|tendance|concurrent)\b/.test(normalized)
  );
}

function flattenRelatedTopics(items: unknown[], results: WebResult[] = []) {
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const topic = item as Record<string, unknown>;
    if (Array.isArray(topic.Topics)) {
      flattenRelatedTopics(topic.Topics, results);
      continue;
    }
    const firstUrl = typeof topic.FirstURL === "string" ? topic.FirstURL : "";
    const text = typeof topic.Text === "string" ? topic.Text : "";
    if (firstUrl && text) {
      results.push({ title: text.split(" - ")[0] || firstUrl, url: firstUrl, snippet: text });
    }
  }
  return results;
}

async function searchWeb(query: string): Promise<WebResult[]> {
  const url = new URL("https://api.duckduckgo.com/");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("no_html", "1");
  url.searchParams.set("skip_disambig", "1");

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "BoardlyFred/1.0" },
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) return [];
    const data = (await response.json()) as Record<string, unknown>;
    const results: WebResult[] = [];

    const abstractUrl = typeof data.AbstractURL === "string" ? data.AbstractURL : "";
    const abstractText = typeof data.AbstractText === "string" ? data.AbstractText : "";
    const heading = typeof data.Heading === "string" ? data.Heading : "";
    if (abstractUrl && (abstractText || heading)) {
      results.push({ title: heading || abstractUrl, url: abstractUrl, snippet: abstractText });
    }

    if (Array.isArray(data.RelatedTopics)) {
      flattenRelatedTopics(data.RelatedTopics, results);
    }

    const deduped = new Map<string, WebResult>();
    for (const result of results) {
      if (!deduped.has(result.url)) deduped.set(result.url, result);
    }
    return [...deduped.values()].slice(0, 6);
  } catch {
    return [];
  }
}

function buildSearchQuery(input: {
  message: string;
  boardContext?: BoardContextPayload;
}) {
  return [input.message, input.boardContext?.title, input.boardContext?.template]
    .filter((part): part is string => Boolean(part && !/^untitled/i.test(part)))
    .join(" ")
    .slice(0, 240);
}

function buildWebBlock(results: WebResult[]) {
  if (!results.length) return "";
  return [
    "--- Résultats web ---",
    ...results.map(
      (result, index) =>
        `${index + 1}. ${result.title}\nURL: ${result.url}${result.snippet ? `\nRésumé: ${result.snippet}` : ""}`
    ),
    "--- Fin résultats web ---",
  ].join("\n");
}

function parseFredResponse(raw: string) {
  const trimmed = raw.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  const candidate = jsonMatch ? jsonMatch[0] : trimmed;
  const parsed = JSON.parse(candidate);
  return FredResponseSchema.parse(parsed);
}

function parseStreamFredResponse(full: string) {
  const markerIdx = full.indexOf(ACTIONS_MARKER);
  const reply = (markerIdx >= 0 ? full.slice(0, markerIdx) : full).trim();
  let actions: FredAction[] = [];
  let memory: string | undefined;

  if (markerIdx >= 0) {
    const after = full.slice(markerIdx + ACTIONS_MARKER.length);
    const endIdx = after.indexOf(ACTIONS_END_MARKER);
    const jsonBlock = (endIdx >= 0 ? after.slice(0, endIdx) : after).trim();
    try {
      const parsed = JSON.parse(jsonBlock) as { actions?: unknown; memory?: string };
      actions = z.array(FredActionSchema).max(5).parse(parsed.actions ?? []);
      memory = parsed.memory;
    } catch {
      /* actions block invalid — reply still usable */
    }
  }

  return { reply: reply || "Je n'ai pas pu formuler une réponse claire. Réessaie.", actions, memory };
}

type FredChatInput = {
  message: string;
  history?: FredChatMessage[];
  boardContext?: BoardContextPayload;
  visionAssets?: VisionAssetInput[];
  toolMode?: FredToolMode;
};

async function prepareFredChat(input: FredChatInput) {
  const mode = input.toolMode ?? "chat";
  const { assets: resolvedVision, skipped } = await resolveVisionAssets(input.visionAssets);
  const webResults = shouldSearchWeb(mode, input.message) ? await searchWeb(buildSearchQuery(input)) : [];

  const enrichedContext: BoardContextPayload | undefined = input.boardContext
    ? {
        ...input.boardContext,
        visionAttached: resolvedVision.length > 0,
        visionCount: resolvedVision.length,
      }
    : resolvedVision.length > 0
      ? { visionAttached: true, visionCount: resolvedVision.length }
      : undefined;

  const contextBlock = buildContextBlock(enrichedContext);
  const modeBlock = `--- Mode Fred ---\n${MODE_INSTRUCTIONS[mode]}\n--- Fin mode ---`;
  const webBlock = buildWebBlock(webResults);
  const history = (input.history ?? []).slice(-8);

  const contents: { role: "user" | "model"; parts: Part[] }[] = [];

  for (const msg of history) {
    contents.push({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    });
  }

  let userText = input.message.trim();
  userText = [modeBlock, contextBlock, webBlock, `Message utilisateur :\n${userText}`]
    .filter(Boolean)
    .join("\n\n");

  const userParts: Part[] = [{ text: userText }, ...buildVisionParts(resolvedVision)];
  contents.push({ role: "user", parts: userParts });

  return {
    contents,
    meta: { visionUsed: resolvedVision.length, visionSkipped: skipped },
  };
}

function buildVisionParts(assets: { label: string; mimeType: string; data: string }[]): Part[] {
  const parts: Part[] = [];
  for (const asset of assets) {
    parts.push({ text: `[Image: ${asset.label}]` });
    parts.push({ inlineData: { mimeType: asset.mimeType, data: asset.data } });
  }
  return parts;
}

export type FredStreamEvent =
  | { type: "delta"; text: string }
  | {
      type: "done";
      reply: string;
      actions: FredAction[];
      memory?: string;
      meta: { visionUsed: number; visionSkipped: number };
    };

export async function chatWithFred(input: FredChatInput) {
  const { contents, meta } = await prepareFredChat(input);

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

  const result = await model.generateContent({ contents });
  const text = result.response.text();

  try {
    const parsed = parseFredResponse(text);
    return { ...parsed, meta };
  } catch {
    return {
      reply: text || "Je n'ai pas pu formuler une réponse claire. Réessaie.",
      actions: [] as FredAction[],
      meta,
    };
  }
}

export async function* streamChatWithFred(input: FredChatInput): AsyncGenerator<FredStreamEvent> {
  const { contents, meta } = await prepareFredChat(input);

  const genAI = getClient();
  const model = genAI.getGenerativeModel({
    model: FRED_MODEL,
    systemInstruction: STREAM_SYSTEM_PROMPT,
    generationConfig: {
      temperature: 0.65,
      maxOutputTokens: 2048,
    },
  });

  const result = await model.generateContentStream({ contents });
  let full = "";
  let visibleEnd = 0;

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (!text) continue;
    full += text;

    const markerIdx = full.indexOf(ACTIONS_MARKER);
    const visibleFull = markerIdx >= 0 ? full.slice(0, markerIdx) : full;
    const delta = visibleFull.slice(visibleEnd);
    if (delta) {
      visibleEnd = visibleFull.length;
      yield { type: "delta", text: delta };
    }
  }

  const parsed = parseStreamFredResponse(full);
  yield {
    type: "done",
    reply: parsed.reply,
    actions: parsed.actions,
    memory: parsed.memory,
    meta,
  };
}

export function isFredConfigured() {
  return !!process.env.GOOGLE_AI_API_KEY;
}
