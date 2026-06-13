import type { LayerType } from "@/lib/types";

/** Layer types rendered as HTML overlay (Safari-safe — avoids SVG foreignObject bugs). */
export const HTML_LAYER_TYPES = new Set<LayerType>(["Link", "Note", "Text", "Image"]);

export function isHtmlLayerType(type: LayerType) {
  return HTML_LAYER_TYPES.has(type);
}
