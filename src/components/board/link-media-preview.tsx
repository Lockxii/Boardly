import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Pause, Play, Volume2, VolumeX } from "lucide-react";
import {
  LINK_PROVIDER_ACCENT,
  fakeTrackDurationSeconds,
  formatTrackTime,
  generateWaveformBars,
  getVideoEmbedUrl,
  isVideoLinkProvider,
  resolveVideoId,
  supportsMusicPlayback,
  tiktokIdFromUrl,
} from "@/lib/link-media-utils";
import { unmuteEmbedPlayer, setEmbedPlayerMuted } from "@/lib/embed-player";
import { isMusicLinkProvider, type LinkProviderId } from "@/lib/link-providers";
import { apiFetch } from "@/lib/utils";
import type { LinkMediaType, LinkPreview, MusicPreview } from "@/lib/types";

const HOVER_DELAY_MS = 250;
const PREVIEW_PROGRESS_STEP = 0.004;

type LinkMediaPreviewProps = {
  src: string;
  provider: LinkProviderId;
  url?: string;
  title?: string;
  videoId?: string;
  videoSrc?: string;
  mediaType?: LinkMediaType;
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
  title,
  videoId,
  videoSrc,
  mediaType,
  height,
  readOnly,
  onImageLoad,
  onImageError,
  brandBadge,
}: LinkMediaPreviewProps) {
  const isMusic = isMusicLinkProvider(provider);
  const isNativeVideo = provider === "twitter" && !!videoSrc && (mediaType === "video" || mediaType === "animated_gif");
  const isEmbedVideo = isVideoLinkProvider(provider);
  const isVideo = isEmbedVideo || isNativeVideo;
  const isTwitterVideo = provider === "twitter";
  const canPlayMusic = isMusic && supportsMusicPlayback(provider);

  const [hovering, setHovering] = useState(false);
  const [showVideoEmbed, setShowVideoEmbed] = useState(false);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [musicLoading, setMusicLoading] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [progress, setProgress] = useState(0);
  const [trackDuration, setTrackDuration] = useState<number | null>(null);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [musicEmbedUrl, setMusicEmbedUrl] = useState<string | null>(null);
  const [resolvedVideoId, setResolvedVideoId] = useState<string | null>(() =>
    resolveVideoId(provider, url, videoId),
  );

  const videoIframeRef = useRef<HTMLIFrameElement>(null);
  const nativeVideoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const rafRef = useRef<number | null>(null);
  const resolveRef = useRef<Promise<void> | null>(null);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    setResolvedVideoId(resolveVideoId(provider, url, videoId));
  }, [provider, url, videoId]);

  const videoEmbedUrl = useMemo(
    () => (isEmbedVideo ? getVideoEmbedUrl(provider, url, { videoId: resolvedVideoId, origin }) : null),
    [isEmbedVideo, provider, url, resolvedVideoId, origin],
  );

  const stopProgress = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const startFakeProgress = useCallback(() => {
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
    if (!url || provider !== "tiktok" || resolvedVideoId) return;
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
  }, [url, provider, resolvedVideoId]);

  const stopMusic = useCallback(() => {
    setMusicPlaying(false);
    setSoundOn(false);
    setMusicLoading(false);
    stopProgress();
    setProgress(0);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [stopProgress]);

  const stopAllAudio = useCallback(() => {
    stopMusic();
    setMusicEmbedUrl(null);
    setAudioSrc(null);
    if (videoIframeRef.current && isEmbedVideo) {
      setEmbedPlayerMuted(videoIframeRef.current, provider, true);
    }
    if (nativeVideoRef.current) {
      nativeVideoRef.current.pause();
      nativeVideoRef.current.currentTime = 0;
      nativeVideoRef.current.muted = true;
    }
  }, [stopMusic, provider, isEmbedVideo]);

  const handleEnter = useCallback(() => {
    if (readOnly) return;
    setHovering(true);
    if (isEmbedVideo && provider === "tiktok" && !resolvedVideoId) {
      void resolveTikTokId();
    }
    if (isMusic && !musicPlaying) startFakeProgress();
  }, [readOnly, isEmbedVideo, provider, resolvedVideoId, resolveTikTokId, isMusic, musicPlaying, startFakeProgress]);

  const handleLeave = useCallback(() => {
    setHovering(false);
    setShowVideoEmbed(false);
    stopAllAudio();
  }, [stopAllAudio]);

  useEffect(() => {
    if (!hovering || readOnly || (!videoEmbedUrl && !isNativeVideo)) {
      if (!hovering) setShowVideoEmbed(false);
      return;
    }
    const timer = setTimeout(() => setShowVideoEmbed(true), HOVER_DELAY_MS);
    return () => clearTimeout(timer);
  }, [hovering, readOnly, videoEmbedUrl, isNativeVideo]);

  useEffect(() => {
    if (!showVideoEmbed || !isNativeVideo || !nativeVideoRef.current) return;
    const video = nativeVideoRef.current;
    video.muted = !soundOn || mediaType === "animated_gif";
    void video.play().catch(() => undefined);
    return () => {
      video.pause();
      video.currentTime = 0;
    };
  }, [showVideoEmbed, isNativeVideo, soundOn, mediaType, videoSrc]);

  useEffect(() => () => {
    stopProgress();
  }, [stopProgress]);

  const handleVideoIframeLoad = useCallback(() => {
    if (!soundOn || !videoIframeRef.current || !isEmbedVideo) return;
    unmuteEmbedPlayer(videoIframeRef.current, provider);
  }, [soundOn, provider, isEmbedVideo]);

  const playAudioPreview = useCallback(async (previewUrl: string, duration?: number) => {
    setMusicEmbedUrl(null);
    if (duration) setTrackDuration(duration);
    setMusicPlaying(true);
    setSoundOn(true);
    stopProgress();
    setAudioSrc(previewUrl);
  }, [stopProgress]);

  useEffect(() => {
    if (!audioSrc || !musicPlaying) return;
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = audioSrc;
    void audio.play().catch(() => {
      setMusicPlaying(false);
      setSoundOn(false);
      setAudioSrc(null);
    });
  }, [audioSrc, musicPlaying]);

  const startMusic = useCallback(
    async (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (readOnly || !canPlayMusic || !url) return;

      if (musicPlaying) {
        stopMusic();
        startFakeProgress();
        return;
      }

      setMusicLoading(true);
      try {
        const params = new URLSearchParams({ url });
        if (title) params.set("title", title);
        const preview = await apiFetch<MusicPreview>(`/api/music-preview?${params}`);

        if (preview.previewUrl) {
          await playAudioPreview(preview.previewUrl, preview.duration);
          return;
        }

        if (preview.embedUrl) {
          const embed = preview.embedUrl.includes("autoplay")
            ? preview.embedUrl
            : `${preview.embedUrl}${preview.embedUrl.includes("?") ? "&" : "?"}autoplay=1`;
          setMusicEmbedUrl(embed);
          setAudioSrc(null);
          setMusicPlaying(true);
          setSoundOn(true);
          stopProgress();
        }
      } catch {
        /* ignore */
      } finally {
        setMusicLoading(false);
      }
    },
    [readOnly, canPlayMusic, url, title, musicPlaying, stopMusic, startFakeProgress, playAudioPreview, stopProgress],
  );

  const toggleSound = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (readOnly) return;

      if (isMusic) {
        if (musicPlaying) {
          if (audioRef.current) {
            audioRef.current.pause();
          }
          setMusicPlaying(false);
          setSoundOn(false);
          startFakeProgress();
        } else {
          void startMusic(e);
        }
        return;
      }

      if (isNativeVideo) {
        const nextSoundOn = mediaType === "animated_gif" ? false : !soundOn;
        setSoundOn(nextSoundOn);
        if (nativeVideoRef.current) {
          nativeVideoRef.current.muted = !nextSoundOn;
          void nativeVideoRef.current.play().catch(() => {
            if (nativeVideoRef.current) nativeVideoRef.current.muted = true;
            setSoundOn(false);
          });
        }
        return;
      }

      if (isEmbedVideo) {
        const nextSoundOn = !soundOn;
        setSoundOn(nextSoundOn);
        if (nextSoundOn && videoIframeRef.current) {
          unmuteEmbedPlayer(videoIframeRef.current, provider);
        } else if (!nextSoundOn && videoIframeRef.current) {
          setEmbedPlayerMuted(videoIframeRef.current, provider, true);
        }
      }
    },
    [readOnly, isMusic, musicPlaying, startFakeProgress, startMusic, isNativeVideo, mediaType, soundOn, isEmbedVideo, provider],
  );

  const bars = isMusic ? generateWaveformBars(url || src) : [];
  const accent = provider !== "generic" ? LINK_PROVIDER_ACCENT[provider] : "#2563EB";
  const duration = trackDuration ?? (isMusic ? fakeTrackDurationSeconds(url || src) : 0);
  const currentTime = Math.floor(duration * progress);
  const isResolvingTikTok = isEmbedVideo && provider === "tiktok" && hovering && !resolvedVideoId;
  const canToggleVideoSound = (isNativeVideo && mediaType !== "animated_gif") || (isEmbedVideo && !isTwitterVideo);

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
        } ${hovering && isMusic && !musicPlaying ? "scale-110 blur-[2px]" : ""} ${showVideoEmbed && (videoEmbedUrl || isNativeVideo) ? "opacity-0" : "opacity-100"}`}
        onLoad={onImageLoad}
        onError={onImageError}
        draggable={false}
      />

      {isMusic && (
        <>
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/10 pointer-events-none" />
          <div className="absolute inset-x-3 bottom-3 top-3 flex flex-col justify-end gap-2 pointer-events-none">
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

          {canPlayMusic && !readOnly && (
            <button
              type="button"
              className="absolute inset-0 z-10 flex items-center justify-center bg-black/0 transition-colors hover:bg-black/10"
              onPointerDown={startMusic}
              title={musicPlaying ? "Pause" : "Écouter un extrait"}
            >
              <div className={`rounded-full p-3 transition-all ${
                musicPlaying ? "bg-blue-600/90 opacity-100" : "bg-black/60 opacity-0 group-hover:opacity-100"
              }`}>
                {musicLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-white" />
                ) : musicPlaying ? (
                  <Pause className="h-5 w-5 text-white" />
                ) : (
                  <Play className="h-5 w-5 fill-white text-white" />
                )}
              </div>
            </button>
          )}
        </>
      )}

      {audioSrc && (
        <audio
          ref={audioRef}
          src={audioSrc}
          preload="auto"
          className="hidden"
          onTimeUpdate={() => {
            const audio = audioRef.current;
            if (!audio || !duration) return;
            setProgress(Math.min(1, audio.currentTime / duration));
          }}
          onEnded={() => {
            stopMusic();
            startFakeProgress();
          }}
        />
      )}

      {musicEmbedUrl && musicPlaying && (
        <div className="absolute inset-x-0 bottom-0 z-20 h-[152px] border-t border-white/10 bg-black/80">
          <iframe
            src={musicEmbedUrl}
            title="Lecture musique"
            className="h-full w-full border-0"
            allow="autoplay; encrypted-media"
            loading="eager"
          />
        </div>
      )}

      {videoEmbedUrl && showVideoEmbed && (
        <iframe
          ref={videoIframeRef}
          key={videoEmbedUrl}
          src={videoEmbedUrl}
          title="Aperçu vidéo"
          className={`${isTwitterVideo ? "pointer-events-auto" : "pointer-events-none"} absolute inset-0 h-full w-full border-0 bg-black`}
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          loading="eager"
          onLoad={handleVideoIframeLoad}
        />
      )}

      {isNativeVideo && videoSrc && showVideoEmbed && (
        <video
          ref={nativeVideoRef}
          key={videoSrc}
          src={videoSrc}
          poster={src}
          className="pointer-events-none absolute inset-0 h-full w-full bg-black object-contain"
          muted={!soundOn || mediaType === "animated_gif"}
          loop
          playsInline
          preload="metadata"
        />
      )}

      {canToggleVideoSound && showVideoEmbed && !!(videoEmbedUrl || videoSrc) && !readOnly && (
        <button
          type="button"
          className={`absolute top-2 right-2 z-10 rounded-md p-1.5 pointer-events-auto transition-colors ${
            soundOn
              ? "bg-blue-600/90 text-white hover:bg-blue-700/90"
              : "bg-black/55 text-white hover:bg-black/75"
          }`}
          onPointerDown={toggleSound}
          title={soundOn ? "Couper le son" : "Activer le son"}
        >
          {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </button>
      )}

      {isMusic && hovering && !canPlayMusic && (
        <div className="absolute top-2 right-2 z-10 rounded-md bg-black/70 px-2 py-1 text-[10px] text-white/90 pointer-events-none">
          Aperçu visuel
        </div>
      )}

      {isVideo && !showVideoEmbed && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-200 group-hover:bg-black/15 pointer-events-none">
          {isResolvingTikTok ? (
            <div className="rounded-full bg-black/65 px-3 py-1.5 text-[11px] font-medium text-white opacity-100">
              Chargement…
            </div>
          ) : (
            <div className="rounded-full bg-black/65 p-2.5 opacity-0 shadow-sm transition-opacity duration-200 group-hover:opacity-100">
              <Play className="h-5 w-5 fill-white text-white" />
            </div>
          )}
        </div>
      )}

      {brandBadge}
    </div>
  );
});
