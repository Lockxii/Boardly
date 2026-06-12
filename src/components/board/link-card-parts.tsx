import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import type { Layer } from "@/lib/types";
import {
  LINK_PROVIDER_META,
  LINK_URL_STRIP_HEIGHT,
  brandIconUrl,
  estimateLinkBodyHeight,
  getLinkImageHeight,
  isColorLinkLogo,
  resolveLinkProvider,
  type LinkProvider,
} from "@/lib/brand-icons";
import { LinkMediaPreview } from "@/components/board/link-media-preview";
import { youtubeIdFromUrl } from "@/lib/link-media-utils";

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

export function LinkProviderBadge({ provider, url }: { provider?: Layer["linkProvider"]; url?: string }) {
  const resolved = resolveLinkProvider(provider, url);
  if (resolved === "generic") return null;
  const meta = LINK_PROVIDER_META[resolved];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shrink-0 ${meta.badgeClass}`}
    >
      <BrandLogo provider={resolved} className="h-4 w-auto max-w-[16px]" mono={meta.logoOnBadge === "mono"} />
      {meta.label}
    </span>
  );
}

export function LinkCardImage({
  src,
  provider,
  url,
  width,
  imageWidth,
  imageHeight,
  linkVideoId,
  linkTitle,
  readOnly,
  onNaturalSize,
}: {
  src: string;
  provider?: Layer["linkProvider"];
  url?: string;
  width: number;
  imageWidth?: number;
  imageHeight?: number;
  linkVideoId?: string;
  linkTitle?: string;
  readOnly?: boolean;
  onNaturalSize?: (width: number, height: number) => void;
}) {
  const videoId = provider === "youtube" ? youtubeIdFromUrl(url) : null;
  const resolved = resolveLinkProvider(provider, url);
  const imageHeightPx = getLinkImageHeight(resolved, width, imageWidth, imageHeight);
  const isMusic = resolved === "spotify" || resolved === "apple-music" || resolved === "deezer" || resolved === "amazon-music" || resolved === "soundcloud";

  const brandBadge =
    resolved !== "generic" ? (
      <div className="absolute bottom-2 left-2 rounded-md bg-black/55 p-1.5 shadow-sm backdrop-blur-sm pointer-events-none">
        <BrandLogo provider={resolved} className="h-4 w-4" mono={!isColorLinkLogo(resolved)} />
      </div>
    ) : null;

  return (
    <LinkMediaPreview
      src={src}
      provider={resolved}
      url={url}
      title={linkTitle}
      videoId={linkVideoId}
      height={imageHeightPx}
      readOnly={readOnly}
      brandBadge={brandBadge}
      onImageLoad={(e) => {
        const img = e.currentTarget;
        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
          onNaturalSize?.(img.naturalWidth, img.naturalHeight);
        }
      }}
      onImageError={(e) => {
        if (provider === "youtube" && videoId && !e.currentTarget.dataset.fallback) {
          e.currentTarget.dataset.fallback = "1";
          e.currentTarget.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        }
      }}
    />
  );
}

export function LinkCardBody({ layer }: { layer: Layer }) {
  const bodyHeight = estimateLinkBodyHeight(
    layer.linkTitle || layer.url || "",
    !!(layer.linkAuthor || layer.linkDescription),
  );

  return (
    <div
      className="flex shrink-0 flex-col gap-1.5 pointer-events-none p-3"
      style={{ minHeight: bodyHeight }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="flex-1 text-sm font-semibold leading-snug text-neutral-900 line-clamp-3 dark:text-white">
          {layer.linkTitle || layer.url}
        </p>
        <LinkProviderBadge provider={layer.linkProvider} url={layer.url} />
      </div>
      {(layer.linkAuthor || layer.linkDescription) && (
        <p className="text-xs text-neutral-500 line-clamp-2">{layer.linkAuthor || layer.linkDescription}</p>
      )}
    </div>
  );
}

function formatDisplayUrl(url: string) {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    return `${parsed.hostname.replace(/^www\./, "")}${path}`.slice(0, 48);
  } catch {
    return url.slice(0, 48);
  }
}

export function LinkUrlEdge({
  url = "",
  selected,
  readOnly,
  onChange,
}: {
  url?: string;
  selected: boolean;
  readOnly: boolean;
  onChange: (url: string) => void;
}) {
  const [draft, setDraft] = useState(url);

  useEffect(() => {
    setDraft(url);
  }, [url]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== url) onChange(trimmed);
    else setDraft(url);
  };

  const editable = selected && !readOnly;

  return (
    <div
      className="shrink-0 pointer-events-auto"
      style={{ height: LINK_URL_STRIP_HEIGHT }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        className={`flex h-full items-center gap-1.5 rounded-md border px-2 text-[10px] shadow-sm backdrop-blur-sm ${
          editable
            ? "border-blue-300 bg-blue-50/95 ring-1 ring-blue-200 dark:border-blue-700 dark:bg-blue-950/80"
            : "border-neutral-200 bg-white/95 dark:border-neutral-700 dark:bg-neutral-900/95"
        }`}
      >
        <ExternalLink className="h-3 w-3 shrink-0 text-blue-500" />
        {editable ? (
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
                (e.target as HTMLInputElement).blur();
              }
              if (e.key === "Escape") {
                setDraft(url);
                (e.target as HTMLInputElement).blur();
              }
            }}
            className="min-w-0 flex-1 bg-transparent text-blue-600 outline-none dark:text-blue-400"
            placeholder="https://..."
            spellCheck={false}
          />
        ) : (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="min-w-0 flex-1 truncate text-blue-600 hover:underline dark:text-blue-400"
            title={url}
            onClick={(e) => e.stopPropagation()}
          >
            {formatDisplayUrl(url)}
          </a>
        )}
      </div>
    </div>
  );
}
