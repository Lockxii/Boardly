import type { Layer } from "@/lib/types";
import {
  LINK_PROVIDER_META,
  brandIconUrl,
  getLinkImageHeight,
  type LinkProvider,
} from "@/lib/brand-icons";

function youtubeIdFromUrl(url?: string) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "").replace(/^m\./, "");
    if (host === "youtu.be") return parsed.pathname.slice(1).split("/")[0] || null;
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts[0] === "shorts" || parts[0] === "embed" || parts[0] === "live") return parts[1] || null;
    return parsed.searchParams.get("v");
  } catch {
    return null;
  }
}

function BrandLogo({
  provider,
  className = "h-3.5 w-3.5",
  mono = false,
}: {
  provider: Exclude<LinkProvider, "generic">;
  className?: string;
  mono?: boolean;
}) {
  const meta = LINK_PROVIDER_META[provider];
  const variant = mono ? "mono" : meta.variant;
  const src = brandIconUrl(meta.slug, variant);
  const useMonoFilter = mono || meta.logoOnBadge === "mono";

  return (
    <img
      src={src}
      alt=""
      className={`${className} object-contain shrink-0 ${useMonoFilter ? "brightness-0 invert" : ""}`}
      draggable={false}
    />
  );
}

export function LinkProviderBadge({ provider }: { provider?: Layer["linkProvider"] }) {
  if (!provider || provider === "generic") return null;
  const meta = LINK_PROVIDER_META[provider];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white ${meta.badgeClass}`}
    >
      <BrandLogo provider={provider} className="h-3.5 w-auto max-w-[14px]" mono={meta.logoOnBadge === "mono"} />
      {meta.label}
    </span>
  );
}

export function LinkCardImage({
  src,
  provider,
  url,
  width,
}: {
  src: string;
  provider?: Layer["linkProvider"];
  url?: string;
  width: number;
}) {
  const videoId = provider === "youtube" ? youtubeIdFromUrl(url) : null;
  const imageHeight = getLinkImageHeight(provider, width);

  return (
    <div className="relative w-full shrink-0 overflow-hidden" style={{ height: imageHeight }}>
      <img
        src={src}
        alt=""
        className={`w-full h-full ${provider === "tiktok" ? "object-cover object-center" : "object-cover"}`}
        onError={(e) => {
          if (provider === "youtube" && videoId && !e.currentTarget.dataset.fallback) {
            e.currentTarget.dataset.fallback = "1";
            e.currentTarget.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
          }
        }}
      />
      {provider && provider !== "generic" && (
        <div className="absolute bottom-2 left-2 rounded-md bg-black/55 backdrop-blur-sm p-1.5 shadow-sm">
          <BrandLogo provider={provider} className="h-4 w-4" mono={provider !== "tiktok"} />
        </div>
      )}
    </div>
  );
}

export function LinkCardBody({ layer }: { layer: Layer }) {
  const isMedia = layer.linkProvider && layer.linkProvider !== "generic";
  return (
    <div className={`p-3 flex-1 flex flex-col gap-1.5 pointer-events-none min-h-0 ${isMedia ? "min-h-[72px]" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-neutral-900 dark:text-white line-clamp-2 flex-1 leading-snug">
          {layer.linkTitle || layer.url}
        </p>
        <LinkProviderBadge provider={layer.linkProvider} />
      </div>
      {(layer.linkAuthor || layer.linkDescription) && (
        <p className="text-xs text-neutral-500 line-clamp-2">{layer.linkAuthor || layer.linkDescription}</p>
      )}
      <p className="text-[10px] text-blue-600 truncate mt-auto">{layer.url}</p>
    </div>
  );
}
