import { Youtube, Music2, Mic2, Play } from "lucide-react";
import type { Layer } from "@/lib/types";

const PROVIDER_META = {
  youtube: { label: "YouTube", className: "bg-red-600 text-white", Icon: Youtube },
  spotify: { label: "Spotify", className: "bg-[#1DB954] text-white", Icon: Music2 },
  tiktok: { label: "TikTok", className: "bg-black text-white", Icon: Play },
  soundcloud: { label: "SoundCloud", className: "bg-[#FF5500] text-white", Icon: Music2 },
  vimeo: { label: "Vimeo", className: "bg-[#1AB7EA] text-white", Icon: Play },
} as const;

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

export function LinkProviderBadge({ provider }: { provider?: Layer["linkProvider"] }) {
  if (!provider || provider === "generic") return null;
  const meta = PROVIDER_META[provider];
  if (!meta) return null;
  const { label, className, Icon } = meta;
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${className}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

export function LinkCardImage({
  src,
  provider,
  url,
}: {
  src: string;
  provider?: Layer["linkProvider"];
  url?: string;
}) {
  const videoId = provider === "youtube" ? youtubeIdFromUrl(url) : null;

  return (
    <img
      src={src}
      alt=""
      className="w-full h-32 object-cover"
      onError={(e) => {
        if (provider === "youtube" && videoId && !e.currentTarget.dataset.fallback) {
          e.currentTarget.dataset.fallback = "1";
          e.currentTarget.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        }
      }}
    />
  );
}

export function LinkCardBody({ layer }: { layer: Layer }) {
  const isMedia = layer.linkProvider && layer.linkProvider !== "generic";
  return (
    <div className={`p-3 flex-1 flex flex-col gap-1.5 pointer-events-none ${isMedia ? "min-h-[72px]" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-neutral-900 dark:text-white line-clamp-2 flex-1">{layer.linkTitle || layer.url}</p>
        <LinkProviderBadge provider={layer.linkProvider} />
      </div>
      {(layer.linkAuthor || layer.linkDescription) && (
        <p className="text-xs text-neutral-500 line-clamp-2 flex items-center gap-1">
          {layer.linkProvider === "spotify" && <Mic2 className="h-3 w-3 shrink-0" />}
          {layer.linkAuthor || layer.linkDescription}
        </p>
      )}
      <p className="text-[10px] text-blue-600 truncate mt-auto">{layer.url}</p>
    </div>
  );
}
