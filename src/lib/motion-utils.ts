import type { Layer } from "@/lib/types";

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function lerpPoint(
  a: { x: number; y: number },
  b: { x: number; y: number },
  t: number
) {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

export function bezierConnectionPath(
  a: { x: number; y: number },
  b: { x: number; y: number }
) {
  const midX = (a.x + b.x) / 2;
  return `M ${a.x} ${a.y} C ${midX} ${a.y}, ${midX} ${b.y}, ${b.x} ${b.y}`;
}

export function getViewportCanvasBounds(
  camera: { x: number; y: number; zoom: number },
  padding = 120
) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  return {
    minX: (-camera.x - padding) / camera.zoom,
    minY: (-camera.y - padding) / camera.zoom,
    maxX: (w - camera.x + padding) / camera.zoom,
    maxY: (h - camera.y + padding) / camera.zoom,
  };
}

export function getLayerBounds(layer: Layer) {
  if (layer.type === "Path" && layer.points?.length) {
    const active = layer.points.filter((p) => p[3] !== 1);
    if (active.length > 0) {
      const absolute = layer.width === 0 && layer.height === 0;
      const xs = active.map((p) => (absolute ? p[0] : p[0] + layer.x));
      const ys = active.map((p) => (absolute ? p[1] : p[1] + layer.y));
      const pad = (layer.strokeWidth || 2) / 2 + 2;
      const minX = Math.min(...xs) - pad;
      const minY = Math.min(...ys) - pad;
      const maxX = Math.max(...xs) + pad;
      const maxY = Math.max(...ys) + pad;
      return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }
  }
  return { x: layer.x, y: layer.y, width: layer.width, height: layer.height };
}

export function isLayerInViewport(
  layer: Layer,
  bounds: ReturnType<typeof getViewportCanvasBounds>
) {
  const box = getLayerBounds(layer);
  return (
    box.x + box.width >= bounds.minX &&
    box.x <= bounds.maxX &&
    box.y + box.height >= bounds.minY &&
    box.y <= bounds.maxY
  );
}

export function rubberBand(value: number, min: number, max: number, constant = 0.35) {
  if (value < min) {
    const overshoot = min - value;
    return min - overshoot * constant;
  }
  if (value > max) {
    const overshoot = value - max;
    return max + overshoot * constant;
  }
  return value;
}

export function pointInLayer(point: { x: number; y: number }, layer: Layer) {
  return (
    point.x >= layer.x &&
    point.x <= layer.x + layer.width &&
    point.y >= layer.y &&
    point.y <= layer.y + layer.height
  );
}

export function findColumnAtPoint(
  layers: Record<string, Layer>,
  layerIds: string[],
  point: { x: number; y: number }
) {
  for (let i = layerIds.length - 1; i >= 0; i--) {
    const layer = layers[layerIds[i]];
    if (layer?.type === "Column" && pointInLayer(point, layer)) return layerIds[i];
  }
  return null;
}
