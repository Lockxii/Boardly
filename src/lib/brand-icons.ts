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

export function getLinkLayerDimensions(preview: {
  image?: string;
  provider?: Layer["linkProvider"];
}) {
  const hasImage = !!preview.image;
  const provider = preview.provider;

  if (provider === "tiktok" && hasImage) {
    const width = 200;
    const imageHeight = Math.round((width * 16) / 9);
    return { width, height: imageHeight + 88 };
  }

  if (provider === "spotify" && hasImage) {
    const width = 240;
    return { width, height: width + 88 };
  }

  const width = 280;
  if (!hasImage) return { width, height: 120 };

  const imageHeight =
    provider === "youtube" || provider === "vimeo"
      ? Math.round((width * 9) / 16)
      : 128;

  const bodyHeight = provider && provider !== "generic" ? 88 : 72;
  return { width, height: imageHeight + bodyHeight };
}

export function getLinkImageHeight(provider: Layer["linkProvider"] | undefined, width: number) {
  if (provider === "tiktok") return Math.round((width * 16) / 9);
  if (provider === "spotify") return width;
  if (provider === "youtube" || provider === "vimeo") return Math.round((width * 9) / 16);
  return 128;
}
