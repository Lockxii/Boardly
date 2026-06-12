import type { Layer } from "@/lib/types";

const PRESENTABLE_TYPES = new Set(["Link", "Image", "Note", "Frame", "Text"]);

export function getPresentationSlides(
  layerIds: string[],
  layers: Record<string, Layer>,
): { id: string; layer: Layer }[] {
  return layerIds
    .map((id) => ({ id, layer: layers[id] }))
    .filter((item): item is { id: string; layer: Layer } => {
      if (!item.layer) return false;
      if (item.layer.locked) return false;
      return PRESENTABLE_TYPES.has(item.layer.type);
    })
    .sort((a, b) => {
      const dy = a.layer.y - b.layer.y;
      if (Math.abs(dy) > 40) return dy;
      return a.layer.x - b.layer.x;
    });
}

export function focusCameraOnLayer(
  layer: Layer,
  viewport = { w: window.innerWidth, h: window.innerHeight },
) {
  const padding = 96;
  const zoom = Math.min(
    (viewport.w - padding * 2) / Math.max(layer.width, 1),
    (viewport.h - padding * 2) / Math.max(layer.height, 1),
    1.8,
  );
  const clampedZoom = Math.max(0.12, Math.min(zoom, 2));
  return {
    x: viewport.w / 2 - (layer.x + layer.width / 2) * clampedZoom,
    y: viewport.h / 2 - (layer.y + layer.height / 2) * clampedZoom,
    zoom: clampedZoom,
  };
}
