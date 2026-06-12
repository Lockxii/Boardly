import type { Layer } from "@/lib/types";

export const NOTE_COLORS = [
  "#FEF3C7",
  "#FECACA",
  "#BBF7D0",
  "#BFDBFE",
  "#E9D5FF",
  "#FED7AA",
] as const;

export function getLayerCenter(layer: Layer) {
  return {
    x: layer.x + layer.width / 2,
    y: layer.y + layer.height / 2,
  };
}

export function getSelectionBounds(layers: Record<string, Layer>, ids: string[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const id of ids) {
    const layer = layers[id];
    if (!layer) continue;
    minX = Math.min(minX, layer.x);
    minY = Math.min(minY, layer.y);
    maxX = Math.max(maxX, layer.x + layer.width);
    maxY = Math.max(maxY, layer.y + layer.height);
  }

  if (!Number.isFinite(minX)) return null;
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

export type AlignKind = "left" | "center" | "right" | "top" | "middle" | "bottom";
export type DistributeKind = "horizontal" | "vertical";

export function computeAlignedPositions(
  layers: Record<string, Layer>,
  ids: string[],
  align: AlignKind
) {
  const bounds = getSelectionBounds(layers, ids);
  if (!bounds) return {};

  const updates: Record<string, Partial<Layer>> = {};

  for (const id of ids) {
    const layer = layers[id];
    if (!layer || layer.locked) continue;

    if (align === "left") updates[id] = { x: bounds.minX };
    if (align === "center") updates[id] = { x: bounds.minX + bounds.width / 2 - layer.width / 2 };
    if (align === "right") updates[id] = { x: bounds.maxX - layer.width };
    if (align === "top") updates[id] = { y: bounds.minY };
    if (align === "middle") updates[id] = { y: bounds.minY + bounds.height / 2 - layer.height / 2 };
    if (align === "bottom") updates[id] = { y: bounds.maxY - layer.height };
  }

  return updates;
}

export function computeDistributedPositions(
  layers: Record<string, Layer>,
  ids: string[],
  axis: DistributeKind
) {
  if (ids.length < 3) return {};

  const sorted = [...ids]
    .map((id) => ({ id, layer: layers[id] }))
    .filter((entry): entry is { id: string; layer: Layer } => !!entry.layer && !entry.layer.locked)
    .sort((a, b) => (axis === "horizontal" ? a.layer.x - b.layer.x : a.layer.y - b.layer.y));

  if (sorted.length < 3) return {};

  const first = sorted[0].layer;
  const last = sorted[sorted.length - 1].layer;
  const updates: Record<string, Partial<Layer>> = {};

  if (axis === "horizontal") {
    const totalSpan = last.x + last.width - first.x;
    const innerWidth = sorted.slice(1, -1).reduce((sum, { layer }) => sum + layer.width, 0);
    const gap = (totalSpan - innerWidth - first.width - last.width) / (sorted.length - 1);
    let cursor = first.x + first.width + gap;
    for (const { id, layer } of sorted.slice(1, -1)) {
      updates[id] = { x: cursor };
      cursor += layer.width + gap;
    }
  } else {
    const totalSpan = last.y + last.height - first.y;
    const innerHeight = sorted.slice(1, -1).reduce((sum, { layer }) => sum + layer.height, 0);
    const gap = (totalSpan - innerHeight - first.height - last.height) / (sorted.length - 1);
    let cursor = first.y + first.height + gap;
    for (const { id, layer } of sorted.slice(1, -1)) {
      updates[id] = { y: cursor };
      cursor += layer.height + gap;
    }
  }

  return updates;
}

export async function compressImageFile(file: File, maxSize = 1280, quality = 0.82): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });

  const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
  const width = Math.round(img.width * scale);
  const height = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

export async function compressDataUrl(src: string, maxSize = 1280, quality = 0.82): Promise<string> {
  const res = await fetch(src);
  const blob = await res.blob();
  const file = new File([blob], "image.jpg", { type: blob.type || "image/jpeg" });
  return compressImageFile(file, maxSize, quality);
}
