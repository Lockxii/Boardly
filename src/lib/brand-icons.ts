import type { Layer } from "@/lib/types";
import { detectLinkProviderFromUrl, isMusicLinkProvider, type LinkProvider, type LinkProviderId } from "@/lib/link-providers";

const THESVG = "https://thesvg.org/icons";

export type { LinkProvider, LinkProviderId };

export const LINK_PROVIDER_META: Record<
  LinkProvider,
  { label: string; slug: string; variant: string; badgeClass: string; logoOnBadge: "color" | "mono" }
> = {
  youtube: { label: "YouTube", slug: "youtube", variant: "default", badgeClass: "bg-red-600", logoOnBadge: "mono" },
  spotify: { label: "Spotify", slug: "spotify", variant: "default", badgeClass: "bg-[#1DB954]", logoOnBadge: "mono" },
  "apple-music": { label: "Apple Music", slug: "apple-music", variant: "default", badgeClass: "bg-[#FA243C]", logoOnBadge: "color" },
  deezer: { label: "Deezer", slug: "deezer", variant: "default", badgeClass: "bg-[#A238FF]", logoOnBadge: "color" },
  "amazon-music": { label: "Amazon Music", slug: "amazon-music", variant: "default", badgeClass: "bg-[#232F3E]", logoOnBadge: "color" },
  tiktok: { label: "TikTok", slug: "tiktok", variant: "light", badgeClass: "bg-black", logoOnBadge: "color" },
  twitter: { label: "X", slug: "x", variant: "default", badgeClass: "bg-black", logoOnBadge: "mono" },
  soundcloud: { label: "SoundCloud", slug: "soundcloud", variant: "default", badgeClass: "bg-[#FF5500]", logoOnBadge: "mono" },
  vimeo: { label: "Vimeo", slug: "vimeo", variant: "default", badgeClass: "bg-[#1AB7EA]", logoOnBadge: "mono" },
};

export function brandIconUrl(slug: string, variant = "default") {
  return `${THESVG}/${slug}/${variant}.svg`;
}

export function resolveLinkProvider(provider?: Layer["linkProvider"], url?: string): LinkProviderId {
  if (provider && provider !== "generic") return provider;
  return detectLinkProviderFromUrl(url || "");
}

export function isColorLinkLogo(provider: LinkProviderId) {
  return provider === "tiktok" || provider === "apple-music" || provider === "deezer" || provider === "amazon-music";
}

export const LINK_URL_STRIP_HEIGHT = 28;
export const LINK_CARD_GAP = 4;

function defaultCardWidth(provider?: LinkProviderId) {
  if (provider === "tiktok") return 220;
  if (provider === "twitter") return 420;
  if (isMusicLinkProvider(provider)) return 240;
  return 280;
}

function fallbackImageAspect(provider?: LinkProviderId) {
  if (provider === "tiktok") return 9 / 16;
  if (isMusicLinkProvider(provider)) return 1;
  if (provider === "youtube" || provider === "vimeo" || provider === "twitter") return 16 / 9;
  return 16 / 10;
}

export function estimateLinkBodyHeight(title: string, hasSubtitle: boolean, provider?: LinkProviderId) {
  const maxLines = provider === "twitter" ? 6 : 3;
  const minHeight = provider === "twitter" ? 116 : 52;
  const titleLines = Math.min(maxLines, Math.max(1, Math.ceil(title.length / 30)));
  const titleHeight = titleLines * 19;
  const subtitleHeight = hasSubtitle ? 18 : 0;
  return Math.max(minHeight, titleHeight + subtitleHeight + 26);
}

export function getLinkImageHeight(
  provider: LinkProviderId | undefined,
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
  provider?: LinkProviderId;
  imageWidth?: number;
  imageHeight?: number;
}) {
  const hasImage = !!preview.image;
  const provider = preview.provider;
  const width = defaultCardWidth(provider);

  if (provider === "twitter" && !hasImage) {
    return { width, height: 462 };
  }

  const hasSubtitle = !!(preview.author || preview.description);
  const bodyHeight = estimateLinkBodyHeight(preview.title || (preview.image ? "Link" : ""), hasSubtitle, provider);
  const chrome = bodyHeight + LINK_URL_STRIP_HEIGHT + LINK_CARD_GAP;

  if (!hasImage) {
    return { width, height: bodyHeight + LINK_URL_STRIP_HEIGHT + LINK_CARD_GAP };
  }

  const imageHeight = getLinkImageHeight(provider, width, preview.imageWidth, preview.imageHeight);
  return { width, height: imageHeight + chrome };
}

export function getLinkLayerHeightFromLayer(layer: Pick<Layer, "type" | "width" | "linkProvider" | "linkTitle" | "linkAuthor" | "linkDescription" | "linkImageWidth" | "linkImageHeight" | "linkImage" | "url">) {
  if (layer.type !== "Link") return layer.width;
  const provider = resolveLinkProvider(layer.linkProvider, layer.url);
  const hasSubtitle = !!(layer.linkAuthor || layer.linkDescription);
  const bodyHeight = estimateLinkBodyHeight(layer.linkTitle || "", hasSubtitle, provider);
  const chrome = bodyHeight + LINK_URL_STRIP_HEIGHT + LINK_CARD_GAP;
  if (!layer.linkImage) return bodyHeight + LINK_URL_STRIP_HEIGHT + LINK_CARD_GAP;
  const imageHeight = getLinkImageHeight(provider, layer.width, layer.linkImageWidth, layer.linkImageHeight);
  return imageHeight + chrome;
}
