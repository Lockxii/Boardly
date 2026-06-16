import { useEffect, useRef, useState } from "react";
import { Music, Play, Pause, SkipBack, SkipForward, X } from "lucide-react";
import { useCanvasStore } from "@/store/canvas-store";
import { apiFetch } from "@/lib/utils";
import { isMusicLinkProvider } from "@/lib/link-providers";
import { focusCameraOnLayer } from "@/lib/presentation-utils";
import type { Layer, MusicPreview } from "@/lib/types";

type Track = { id: string; title: string; url: string; provider?: string };

function isMusicCard(layer: Layer) {
  return layer.type === "Link" && !!layer.url && isMusicLinkProvider(layer.linkProvider);
}

function collectTracks(): Track[] {
  const { layers, layerIds } = useCanvasStore.getState();
  return layerIds
    .map((id) => ({ id, layer: layers[id] }))
    .filter((x) => x.layer && isMusicCard(x.layer))
    .map(({ id, layer }) => ({
      id,
      title: layer.linkTitle || layer.url || "Piste",
      url: layer.url!,
      provider: layer.linkProvider,
    }));
}

export function MusicPlaylist() {
  // Cheap count selector: re-renders only when the number of music cards changes.
  const musicCount = useCanvasStore((s) => {
    let n = 0;
    for (const id of s.layerIds) if (s.layers[id] && isMusicCard(s.layers[id])) n++;
    return n;
  });

  const [open, setOpen] = useState(false);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [current, setCurrent] = useState(-1);
  const [status, setStatus] = useState<"idle" | "loading" | "playing" | "paused" | "noPreview">("idle");
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => setCurrent((c) => (c >= 0 ? c + 1 : c));
    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, []);

  // Load + play whenever `current` advances.
  useEffect(() => {
    if (!open || current < 0 || current >= tracks.length) {
      if (current >= tracks.length) {
        setStatus("idle");
        setCurrent(-1);
      }
      return;
    }
    let cancelled = false;
    const track = tracks[current];
    const layer = useCanvasStore.getState().layers[track.id];
    if (layer) {
      useCanvasStore.getState().setCamera(focusCameraOnLayer(layer));
      useCanvasStore.getState().setSelection([track.id]);
    }
    setStatus("loading");
    (async () => {
      try {
        const params = new URLSearchParams({ url: track.url });
        if (track.title) params.set("title", track.title);
        const preview = await apiFetch<MusicPreview>(`/api/music-preview?${params}`);
        if (cancelled) return;
        if (preview.previewUrl && audioRef.current) {
          audioRef.current.src = preview.previewUrl;
          await audioRef.current.play();
          if (!cancelled) setStatus("playing");
        } else {
          setStatus("noPreview"); // Spotify/SoundCloud: embed-only, no direct audio
        }
      } catch {
        if (!cancelled) setStatus("noPreview");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [current, open, tracks]);

  if (musicCount === 0) return null;

  const start = () => {
    const list = collectTracks();
    setTracks(list);
    setOpen(true);
    setCurrent(list.length ? 0 : -1);
  };

  const close = () => {
    audioRef.current?.pause();
    setOpen(false);
    setStatus("idle");
    setCurrent(-1);
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (status === "playing") {
      audio.pause();
      setStatus("paused");
    } else if (status === "paused") {
      void audio.play();
      setStatus("playing");
    } else if (current >= 0) {
      setCurrent((c) => c); // re-trigger load effect
    }
  };

  const step = (delta: number) => {
    setCurrent((c) => Math.min(tracks.length - 1, Math.max(0, c + delta)));
  };

  const currentTrack = current >= 0 ? tracks[current] : null;

  return (
    <div className="pointer-events-auto fixed bottom-4 left-4 z-40">
      <audio ref={audioRef} hidden />
      {!open ? (
        <button
          type="button"
          onClick={start}
          className="flex items-center gap-1.5 rounded-full border border-neutral-200/80 bg-white/90 px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur transition-colors hover:bg-neutral-50 dark:border-neutral-700/80 dark:bg-neutral-900/90 dark:hover:bg-neutral-800"
        >
          <Music className="h-3.5 w-3.5" /> Playlist · {musicCount}
        </button>
      ) : (
        <div className="w-64 rounded-2xl border border-neutral-200/80 bg-white/95 p-2.5 shadow-xl backdrop-blur dark:border-neutral-700/80 dark:bg-neutral-900/95">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold">
              <Music className="h-3.5 w-3.5 text-blue-500" /> Playlist
            </span>
            <button type="button" onClick={close} aria-label="Fermer" className="rounded-full p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mb-2 truncate text-xs text-neutral-600 dark:text-neutral-300">
            {currentTrack ? currentTrack.title : "—"}
            {status === "loading" && <span className="text-neutral-400"> · chargement…</span>}
            {status === "noPreview" && <span className="text-amber-500"> · aperçu indispo (ouvre la carte)</span>}
          </div>

          <div className="flex items-center justify-center gap-2">
            <button type="button" onClick={() => step(-1)} aria-label="Précédent" className="rounded-full p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800">
              <SkipBack className="h-4 w-4" />
            </button>
            <button type="button" onClick={togglePlay} aria-label="Lecture/pause" className="rounded-full bg-blue-600 p-2 text-white hover:bg-blue-700">
              {status === "playing" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button type="button" onClick={() => step(1)} aria-label="Suivant" className="rounded-full p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800">
              <SkipForward className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-2 max-h-40 overflow-y-auto border-t border-neutral-100 pt-1 dark:border-neutral-800">
            {tracks.map((t, i) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setCurrent(i)}
                className={`flex w-full items-center gap-1.5 truncate rounded-md px-2 py-1 text-left text-[11px] ${i === current ? "bg-blue-50 font-medium dark:bg-blue-950/40" : "hover:bg-neutral-50 dark:hover:bg-neutral-800"}`}
              >
                <span className="w-4 shrink-0 text-neutral-400">{i + 1}</span>
                <span className="truncate">{t.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
