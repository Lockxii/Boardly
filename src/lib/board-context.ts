import type { BoardConnection, Layer } from "@/lib/types";

const MAX_SUMMARY_ITEMS = 40;

function truncate(text: string, max = 120) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

function describeLayer(layer: Layer): string {
  switch (layer.type) {
    case "Note":
    case "Text":
      return layer.value ? `${layer.type}: "${truncate(layer.value)}"` : layer.type;
    case "Link":
      return `Lien: ${layer.linkTitle || layer.url || "sans titre"}`;
    case "Image":
      return "Image";
    case "Frame":
      return layer.value ? `Cadre "${truncate(layer.value, 40)}"` : "Cadre";
    case "Path":
      return "Dessin";
    default:
      return layer.type;
  }
}

export function buildBoardSummary(input: {
  title?: string;
  template?: string;
  layers: Record<string, Layer>;
  layerIds: string[];
  selection: string[];
  connections: BoardConnection[];
}) {
  const { layers, layerIds, selection, connections } = input;
  const items = layerIds
    .map((id) => layers[id])
    .filter(Boolean)
    .slice(0, MAX_SUMMARY_ITEMS)
    .map((layer, i) => `${i + 1}. ${describeLayer(layer)}`);

  const selected = selection
    .map((id) => layers[id])
    .filter(Boolean)
    .map((layer) => describeLayer(layer));

  const parts: string[] = [];
  if (items.length) parts.push(items.join("\n"));
  if (layerIds.length > MAX_SUMMARY_ITEMS) {
    parts.push(`… et ${layerIds.length - MAX_SUMMARY_ITEMS} autres éléments`);
  }
  if (selected.length) {
    parts.push(`\nSélection actuelle :\n${selected.join("\n")}`);
  }
  if (connections.length) {
    parts.push(`\n${connections.length} connexion(s) entre éléments`);
  }

  return {
    layerCount: layerIds.length,
    selectionCount: selection.length,
    summary: parts.join("\n") || "Tableau vide.",
  };
}
