import type { Layer } from "@/lib/types";

const THESVG = "https://thesvg.org/icons";

export type LinkProvider = NonNullable<Layer["linkProvider"]>;

export const LINK_PROVIDER_META: Record<
  Exclude<LinkProvider, "generic">,
  { label: string; slug: string; variant: string; badgeClass: string; logoOnBadge: "color" | "mono" }
> = {
  youtube: { label: "YouTube", slug: "youtube", variant: "default", badgeClass: "bg-red-600", logoOnBadge: "mono" },
  spotify: { label: "Spotify", slug: "spotify", variant: "default", badgeClass: "bg-[#1DB954]", logoOnBadge: "mono" },
  tiktok: { label: "TikTok", slug: "tiktok", variant: "light", badgeClass: "bg-black", logoOnBadge: "color" },
  soundcloud: { label: "SoundCloud", slug: "soundcloud", variant: "default", badgeClass: "bg-[#FF5500]", logoOnBadge: "mono" },
  vimeo: { label: "Vimeo", slug: "vimeo", variant: "default", badgeClass: "bg-[#1AB7EA]", logoOnBadge: "mono" },
};

export function brandIconUrl(slug: string, variant = "default") {
  return `${THESVG}/${slug}/${variant}.svg`;
}

export const LINK_URL_STRIP_HEIGHT = 28;
export const LINK_CARD_GAP = 4;

function defaultCardWidth(provider?: Layer["linkProvider"]) {
  if (provider === "tiktok") return 220;
  if (provider === "spotify") return 240;
  return 280;
}

function fallbackImageAspect(provider?: Layer["linkProvider"]) {
  if (provider === "tiktok") return 9 / 16;
  if (provider === "spotify") return 1;
  if (provider === "youtube" || provider === "vimeo") return 16 / 9;
  return 16 / 10;
}

export function estimateLinkBodyHeight(title: string, hasSubtitle: boolean) {
  const titleLines = Math.min(3, Math.max(1, Math.ceil(title.length / 30)));
  const titleHeight = titleLines * 19;
  const subtitleHeight = hasSubtitle ? 18 : 0;
  return Math.max(52, titleHeight + subtitleHeight + 26);
}

export function getLinkImageHeight(
  provider: Layer["linkProvider"] | undefined,
  cardWidth: number,
  imageWidth?: number,
  imageHeight?: number,
) {
  if (imageWidth && imageHeight && imageWidth > 0 && imageHeight > 0) {
    return Math.round(cardWidth * (imageHeight / imageWidth));
  }
  const aspect = fallbackImageAspect(provider);
  return Math.round(cardWidth / aspect);
}

export function getLinkLayerDimensions(preview: {
  image?: string;
  title?: string;
  description?: string;
  author?: string;
  provider?: Layer["linkProvider"];
  imageWidth?: number;
  imageHeight?: number;
}) {
  const hasImage = !!preview.image;
  const provider = preview.provider;
  const width = defaultCardWidth(provider);
  const hasSubtitle = !!(preview.author || preview.description);
  const bodyHeight = estimateLinkBodyHeight(preview.title || preview.image ? "Link" : "", hasSubtitle);
  const chrome = bodyHeight + LINK_URL_STRIP_HEIGHT + LINK_CARD_GAP;

  if (!hasImage) {
    return { width, height: bodyHeight + LINK_URL_STRIP_HEIGHT + LINK_CARD_GAP };
  }

  const imageHeight = getLinkImageHeight(provider, width, preview.imageWidth, preview.imageHeight);
  return { width, height: imageHeight + chrome };
}

export function getLinkLayerHeightFromLayer(layer: Pick<Layer, "type" | "width" | "linkProvider" | "linkTitle" | "linkAuthor" | "linkDescription" | "linkImageWidth" | "linkImageHeight" | "linkImage">) {
  if (layer.type !== "Link") return layer.width;
  const hasSubtitle = !!(layer.linkAuthor || layer.linkDescription);
  const bodyHeight = estimateLinkBodyHeight(layer.linkTitle || "", hasSubtitle);
  const chrome = bodyHeight + LINK_URL_STRIP_HEIGHT + LINK_CARD_GAP;
  if (!layer.linkImage) return bodyHeight + LINK_URL_STRIP_HEIGHT + LINK_CARD_GAP;
  const imageHeight = getLinkImageHeight(layer.linkProvider, layer.width, layer.linkImageWidth, layer.linkImageHeight);
  return imageHeight + chrome;
}
