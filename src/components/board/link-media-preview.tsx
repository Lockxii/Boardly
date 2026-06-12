import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Play, Volume2, VolumeX } from "lucide-react";
import {
  LINK_PROVIDER_ACCENT,
  fakeTrackDurationSeconds,
  formatTrackTime,
  generateWaveformBars,
  getVideoEmbedUrl,
  isVideoLinkProvider,
  resolveVideoId,
  tiktokIdFromUrl,
} from "@/lib/link-media-utils";
import { isMusicLinkProvider, type LinkProviderId } from "@/lib/link-providers";
import { apiFetch } from "@/lib/utils";
import type { LinkPreview } from "@/lib/types";

const HOVER_DELAY_MS = 250;
const PREVIEW_PROGRESS_STEP = 0.004;

type LinkMediaPreviewProps = {
  src: string;
  provider: LinkProviderId;
  url?: string;
  videoId?: string;
  height: number;
  readOnly?: boolean;
  onImageLoad?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
  onImageError?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
  brandBadge?: React.ReactNode;
};

export const LinkMediaPreview = memo(function LinkMediaPreview({
  src,
  provider,
  url,
  videoId,
  height,
  readOnly,
  onImageLoad,
  onImageError,
  brandBadge,
}: LinkMediaPreviewProps) {
  const isMusic = isMusicLinkProvider(provider);
  const isVideo = isVideoLinkProvider(provider);

  const [hovering, setHovering] = useState(false);
  const [showEmbed, setShowEmbed] = useState(false);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [resolvedVideoId, setResolvedVideoId] = useState<string | null>(() =>
    resolveVideoId(provider, url, videoId),
  );
  const rafRef = useRef<number | null>(null);
  const resolveRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    setResolvedVideoId(resolveVideoId(provider, url, videoId));
  }, [provider, url, videoId]);

  const effectiveVideoId = resolvedVideoId;
  const embedUrl = useMemo(
    () => (isVideo ? getVideoEmbedUrl(provider, url, { muted, videoId: effectiveVideoId }) : null),
    [isVideo, provider, url, muted, effectiveVideoId],
  );

  const stopProgress = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setProgress(0);
  }, []);

  const startProgress = useCallback(() => {
    stopProgress();
    const tick = () => {
      setProgress((p) => {
        if (p >= 0.42) return 0.06;
        return p + PREVIEW_PROGRESS_STEP;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [stopProgress]);

  const resolveTikTokId = useCallback(async () => {
    if (!url || provider !== "tiktok" || effectiveVideoId) return;
    if (resolveRef.current) return resolveRef.current;

    resolveRef.current = apiFetch<LinkPreview>(`/api/link-preview?url=${encodeURIComponent(url)}`)
      .then((preview) => {
        const id = preview.videoId || tiktokIdFromUrl(preview.url) || tiktokIdFromUrl(url);
        if (id) setResolvedVideoId(id);
      })
      .catch(() => undefined)
      .finally(() => {
        resolveRef.current = null;
      });

    return resolveRef.current;
  }, [url, provider, effectiveVideoId]);

  const handleEnter = useCallback(() => {
    if (readOnly) return;
    setHovering(true);
    if (isVideo && provider === "tiktok" && !effectiveVideoId) {
      void resolveTikTokId();
    }
    if (isMusic) startProgress();
  }, [readOnly, isVideo, provider, effectiveVideoId, resolveTikTokId, isMusic, startProgress]);

  const handleLeave = useCallback(() => {
    setHovering(false);
    setShowEmbed(false);
    setMuted(true);
    stopProgress();
  }, [stopProgress]);

  useEffect(() => {
    if (!hovering || readOnly || !embedUrl) {
      if (!hovering) setShowEmbed(false);
      return;
    }
    const timer = setTimeout(() => setShowEmbed(true), HOVER_DELAY_MS);
    return () => clearTimeout(timer);
  }, [hovering, readOnly, embedUrl]);

  useEffect(() => () => {
    stopProgress();
  }, [stopProgress]);

  const bars = isMusic ? generateWaveformBars(url || src) : [];
  const accent = provider !== "generic" ? LINK_PROVIDER_ACCENT[provider] : "#2563EB";
  const duration = isMusic ? fakeTrackDurationSeconds(url || src) : 0;
  const currentTime = Math.floor(duration * progress);
  const canPreviewVideo = isVideo && !!embedUrl;
  const isResolvingTikTok = isVideo && provider === "tiktok" && hovering && !effectiveVideoId;

  return (
    <div
      className={`group relative w-full shrink-0 overflow-hidden pointer-events-auto ${
        isMusic ? "bg-neutral-900" : "bg-neutral-100 dark:bg-neutral-950"
      }`}
      style={{ height }}
      onPointerEnter={handleEnter}
      onPointerLeave={handleLeave}
    >
      <img
        src={src}
        alt=""
        className={`h-full w-full transition-transform duration-300 ${
          isMusic ? "object-cover scale-105" : "object-contain"
        } ${hovering && isMusic ? "scale-110 blur-[2px]" : ""} ${showEmbed && canPreviewVideo ? "opacity-0" : "opacity-100"}`}
        onLoad={onImageLoad}
        onError={onImageError}
      />

      {isMusic && (
        <>
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/10" />
          <div className="absolute inset-x-3 bottom-3 top-3 flex flex-col justify-end gap-2">
            <div className="flex h-[52%] min-h-[36px] items-end justify-center gap-[2px]">
              {bars.map((barHeight, i) => {
                const played = i / bars.length < progress;
                return (
                  <div
                    key={i}
                    className="w-[2px] shrink-0 rounded-full transition-colors duration-100"
                    style={{
                      height: `${Math.round(barHeight * 100)}%`,
                      backgroundColor: played ? accent : "rgba(255,255,255,0.28)",
                      minHeight: 3,
                    }}
                  />
                );
              })}
            </div>
            <div className="flex items-center justify-between text-[10px] font-medium tabular-nums text-white/90">
              <span className="rounded bg-black/45 px-1 py-0.5">{formatTrackTime(currentTime)}</span>
              <span className="rounded bg-black/45 px-1 py-0.5">{formatTrackTime(duration)}</span>
            </div>
          </div>
          {!hovering && (
            <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              <div className="rounded-full bg-black/45 p-2.5 backdrop-blur-sm">
                <Play className="h-4 w-4 fill-white text-white" />
              </div>
            </div>
          )}
        </>
      )}

      {canPreviewVideo && showEmbed && (
        <iframe
          key={embedUrl}
          src={embedUrl}
          title="Aperçu vidéo"
          className="pointer-events-none absolute inset-0 h-full w-full border-0 bg-black"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          loading="eager"
        />
      )}

      {canPreviewVideo && showEmbed && (
        <button
          type="button"
          className="absolute top-2 right-2 z-10 rounded-md bg-black/55 p-1.5 text-white backdrop-blur-sm pointer-events-auto transition-colors hover:bg-black/75"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setMuted((value) => !value);
          }}
          title={muted ? "Activer le son" : "Couper le son"}
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      )}

      {isVideo && !showEmbed && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-200 group-hover:bg-black/15">
          {isResolvingTikTok ? (
            <div className="rounded-full bg-black/50 px-3 py-1.5 text-[11px] font-medium text-white opacity-100 backdrop-blur-sm">
              Chargement…
            </div>
          ) : (
            <div className="rounded-full bg-black/50 p-2.5 opacity-0 shadow-sm backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100">
              <Play className="h-5 w-5 fill-white text-white" />
            </div>
          )}
        </div>
      )}

      {brandBadge}
    </div>
  );
});
