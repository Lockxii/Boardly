import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import {
  LINK_PROVIDER_ACCENT,
  fakeTrackDurationSeconds,
  formatTrackTime,
  generateWaveformBars,
  getVideoEmbedUrl,
  isVideoLinkProvider,
} from "@/lib/link-media-utils";
import { isMusicLinkProvider, type LinkProviderId } from "@/lib/link-providers";

const HOVER_DELAY_MS = 350;
const PREVIEW_PROGRESS_STEP = 0.004;

type LinkMediaPreviewProps = {
  src: string;
  provider: LinkProviderId;
  url?: string;
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
  height,
  readOnly,
  onImageLoad,
  onImageError,
  brandBadge,
}: LinkMediaPreviewProps) {
  const isMusic = isMusicLinkProvider(provider);
  const isVideo = isVideoLinkProvider(provider);
  const embedUrl = isVideo ? getVideoEmbedUrl(provider, url) : null;

  const [hovering, setHovering] = useState(false);
  const [showEmbed, setShowEmbed] = useState(false);
  const [progress, setProgress] = useState(0);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);

  const clearHoverTimer = useCallback(() => {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  }, []);

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

  const handleEnter = useCallback(() => {
    if (readOnly) return;
    setHovering(true);
    clearHoverTimer();
    hoverTimer.current = setTimeout(() => {
      setShowEmbed(true);
      if (isMusic) startProgress();
    }, HOVER_DELAY_MS);
  }, [readOnly, clearHoverTimer, isMusic, startProgress]);

  const handleLeave = useCallback(() => {
    setHovering(false);
    setShowEmbed(false);
    clearHoverTimer();
    stopProgress();
  }, [clearHoverTimer, stopProgress]);

  useEffect(() => () => {
    clearHoverTimer();
    stopProgress();
  }, [clearHoverTimer, stopProgress]);

  const bars = isMusic ? generateWaveformBars(url || src) : [];
  const accent = provider !== "generic" ? LINK_PROVIDER_ACCENT[provider] : "#2563EB";
  const duration = isMusic ? fakeTrackDurationSeconds(url || src) : 0;
  const currentTime = Math.floor(duration * progress);

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
        } ${hovering && isMusic ? "scale-110 blur-[2px]" : ""} ${showEmbed && embedUrl ? "opacity-0" : "opacity-100"}`}
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

      {isVideo && embedUrl && showEmbed && (
        <iframe
          src={embedUrl}
          title="Aperçu vidéo"
          className="pointer-events-none absolute inset-0 h-full w-full border-0 bg-black"
          allow="autoplay; encrypted-media; picture-in-picture"
          loading="lazy"
        />
      )}

      {isVideo && embedUrl && !showEmbed && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-200 group-hover:bg-black/15">
          <div className="rounded-full bg-black/50 p-2.5 opacity-0 shadow-sm backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100">
            <Play className="h-5 w-5 fill-white text-white" />
          </div>
        </div>
      )}

      {brandBadge}
    </div>
  );
});
