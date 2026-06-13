import type { BoardConnection, Layer } from "@/lib/types";

const MAX_SUMMARY_ITEMS = 40;

function truncate(text: string, max = 120) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

function describeLayer(id: string, layer: Layer): string {
  const base = `[id:${id}]`;
  const meta = `pos(${Math.round(layer.x)},${Math.round(layer.y)}) size(${Math.round(layer.width)}x${Math.round(layer.height)})`;
  switch (layer.type) {
    case "Note":
    case "Text":
      return layer.value
        ? `${base} ${layer.type}: "${truncate(layer.value)}" ${meta}${layer.fill ? ` fill:${layer.fill}` : ""}`
        : `${base} ${layer.type} ${meta}`;
    case "Link":
      return `${base} Lien: ${truncate(layer.linkTitle || layer.url || "sans titre")}${layer.linkImage ? " [preview]" : ""} ${meta}`;
    case "Image":
      return `${base} ${layer.src ? "Image [visuelle]" : "Image"} ${meta}`;
    case "Frame":
      return layer.value ? `${base} Cadre "${truncate(layer.value, 40)}" ${meta}` : `${base} Cadre ${meta}`;
    case "Path":
      return `${base} Dessin ${meta}`;
    default:
      return `${base} ${layer.type} ${meta}`;
  }
}

export function countVisionLayers(layers: Record<string, Layer>, layerIds: string[]) {
  return layerIds.filter((id) => {
    const layer = layers[id];
    if (!layer) return false;
    if (layer.type === "Image" && layer.src) return true;
    if (layer.type === "Link" && layer.linkImage) return true;
    return false;
  }).length;
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
    .map((id) => ({ id, layer: layers[id] }))
    .filter(({ layer }) => Boolean(layer))
    .slice(0, MAX_SUMMARY_ITEMS)
    .map(({ id, layer }, i) => `${i + 1}. ${describeLayer(id, layer)}`);

  const selected = selection
    .map((id) => ({ id, layer: layers[id] }))
    .filter(({ layer }) => Boolean(layer))
    .map(({ id, layer }) => describeLayer(id, layer));

  const visionCount = countVisionLayers(layers, layerIds);

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
    visionCount,
    summary: parts.join("\n") || "Tableau vide.",
  };
}

export function buildLinkedLayersSummary(linkedIds: string[], layers: Record<string, Layer>) {
  if (!linkedIds.length) return "";
  const lines = linkedIds
    .map((id) => ({ id, layer: layers[id] }))
    .filter(({ layer }) => Boolean(layer))
    .map(({ id, layer }, i) => `${i + 1}. ${describeLayer(id, layer)}`);
  return lines.length ? `Éléments liés au message :\n${lines.join("\n")}` : "";
}
