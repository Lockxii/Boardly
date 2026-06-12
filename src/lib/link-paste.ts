import type { LinkPreview } from "@/lib/types";
import { getLinkLayerDimensions } from "@/lib/brand-icons";
import { detectLinkProviderFromUrl } from "@/lib/link-providers";

export type LinkPasteItem = {
  preview: LinkPreview;
  x: number;
  y: number;
  width: number;
  height: number;
};

export function buildFallbackLinkPreview(url: string): LinkPreview {
  let hostname = url;
  try {
    hostname = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    /* keep raw */
  }
  return {
    url,
    title: hostname,
    description: url,
    image: "",
    provider: detectLinkProviderFromUrl(url),
  };
}

export function layoutLinkPasteGrid(
  previews: LinkPreview[],
  centerX: number,
  centerY: number,
  gap = 20,
): LinkPasteItem[] {
  if (previews.length === 0) return [];

  const sizes = previews.map((preview) => getLinkLayerDimensions(preview));
  const cols =
    previews.length <= 1 ? 1 : previews.length <= 4 ? 2 : Math.min(4, Math.ceil(Math.sqrt(previews.length)));

  const rowCount = Math.ceil(previews.length / cols);
  const rowHeights: number[] = [];
  const rowWidths: number[] = [];

  for (let r = 0; r < rowCount; r++) {
    const start = r * cols;
    const end = Math.min(start + cols, previews.length);
    const rowSizes = sizes.slice(start, end);
    rowHeights.push(Math.max(...rowSizes.map((s) => s.height)));
    rowWidths.push(rowSizes.reduce((sum, s, i) => sum + s.width + (i > 0 ? gap : 0), 0));
  }

  const totalHeight = rowHeights.reduce((sum, h, i) => sum + h + (i > 0 ? gap : 0), 0);
  let y = centerY - totalHeight / 2;
  const items: LinkPasteItem[] = [];

  for (let r = 0; r < rowCount; r++) {
    const start = r * cols;
    const end = Math.min(start + cols, previews.length);
    let x = centerX - rowWidths[r] / 2;

    for (let i = start; i < end; i++) {
      const { width, height } = sizes[i];
      items.push({ preview: previews[i], x, y, width, height });
      x += width + gap;
    }

    y += rowHeights[r] + gap;
  }

  return items;
}
