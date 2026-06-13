import type { Layer } from "@/lib/types";

export type FredVisionMode = "auto" | "selection" | "off";

export type FredVisionAssetPayload = {
  label: string;
  mimeType?: string;
  data?: string;
  src?: string;
};

const MAX_IMAGES = 3;
const MAX_DIMENSION = 768;
const MAX_BYTES = 380_000;
const IMAGE_INTENT =
  /\b(analys|image|photo|visuel|visuelle|ref|réf|moodboard|couleur|palette|décris|regarde|screenshot|aperçu|thumbnail|miniature|inspir)\b/i;

function layerImageSrc(layer: Layer): string | null {
  if (layer.type === "Image" && layer.src) return layer.src;
  if (layer.type === "Link" && layer.linkImage) return layer.linkImage;
  return null;
}

function layerVisionLabel(layer: Layer, id: string): string {
  if (layer.type === "Image") return "Image";
  if (layer.type === "Link") return layer.linkTitle || layer.url || "Carte lien";
  return id.slice(0, 6);
}

export function listVisionLayerIds(
  layers: Record<string, Layer>,
  layerIds: string[],
  selection: string[]
) {
  const selected = selection.filter((id) => layerImageSrc(layers[id]));
  if (selected.length) return selected.slice(0, MAX_IMAGES);

  return layerIds.filter((id) => layerImageSrc(layers[id])).slice(-MAX_IMAGES);
}

export function shouldAttachVision(
  mode: FredVisionMode,
  message: string,
  layers: Record<string, Layer>,
  layerIds: string[],
  selection: string[]
) {
  if (mode === "off") return false;
  const selectedVision = selection.filter((id) => layerImageSrc(layers[id]));
  if (mode === "selection") return selectedVision.length > 0;
  if (selectedVision.length > 0) return true;
  if (IMAGE_INTENT.test(message)) {
    return layerIds.some((id) => layerImageSrc(layers[id]));
  }
  return false;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function resolveFetchableSrc(src: string): Promise<string> {
  if (src.startsWith("data:")) return src;
  if (src.startsWith("/")) {
    const res = await fetch(src, { credentials: "include" });
    if (!res.ok) throw new Error("fetch failed");
    return blobToDataUrl(await res.blob());
  }
  return src;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function compressToPayload(label: string, src: string): Promise<FredVisionAssetPayload | null> {
  try {
    const resolved = await resolveFetchableSrc(src);

    if (resolved.startsWith("data:") || resolved.startsWith("/")) {
      const dataUrl =
        resolved.startsWith("data:") ? resolved : await resolveFetchableSrc(resolved);
      const img = await loadImage(dataUrl);
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight, 1));
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      let quality = 0.85;
      let dataUrlOut = canvas.toDataURL("image/jpeg", quality);
      while (dataUrlOut.length > MAX_BYTES * 1.4 && quality > 0.45) {
        quality -= 0.08;
        dataUrlOut = canvas.toDataURL("image/jpeg", quality);
      }
      if (dataUrlOut.length > MAX_BYTES * 1.4) return null;

      const match = dataUrlOut.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) return null;
      return { label, mimeType: match[1], data: match[2] };
    }

    return { label, src: resolved };
  } catch {
    if (/^https?:\/\//i.test(src)) return { label, src };
    return null;
  }
}

export async function buildVisionPayload(input: {
  mode: FredVisionMode;
  message: string;
  layers: Record<string, Layer>;
  layerIds: string[];
  selection: string[];
}): Promise<{ assets: FredVisionAssetPayload[]; skipped: number; attached: boolean }> {
  const { mode, message, layers, layerIds, selection } = input;
  if (!shouldAttachVision(mode, message, layers, layerIds, selection)) {
    return { assets: [], skipped: 0, attached: false };
  }

  const ids =
    mode === "selection" || selection.some((id) => layerImageSrc(layers[id]))
      ? selection.filter((id) => layerImageSrc(layers[id])).slice(0, MAX_IMAGES)
      : listVisionLayerIds(layers, layerIds, selection);

  const assets: FredVisionAssetPayload[] = [];
  let skipped = 0;

  for (const id of ids) {
    const layer = layers[id];
    const src = layer ? layerImageSrc(layer) : null;
    if (!layer || !src) continue;

    const payload = await compressToPayload(layerVisionLabel(layer, id), src);
    if (payload) assets.push(payload);
    else skipped += 1;
  }

  return { assets, skipped, attached: assets.length > 0 };
}

export function describeVisionMode(mode: FredVisionMode) {
  switch (mode) {
    case "auto":
      return "Auto";
    case "selection":
      return "Sélection";
    case "off":
      return "Off";
  }
}
