import { useEffect, useMemo, useRef, useState } from "react";
import { CircleStop, Mic, Pause, Play, RefreshCw, Upload, X } from "lucide-react";
import { toast } from "sonner";
import type { Layer } from "@/lib/types";
import { useVoiceRecorder } from "@/lib/use-voice-recorder";
import { useCanvasStore } from "@/store/canvas-store";

function formatTime(totalSeconds?: number) {
  const safeSeconds = Math.max(0, Math.round(totalSeconds || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function seededBars(seed: string, count: number) {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) hash = Math.imul(hash ^ seed.charCodeAt(i), 16777619);
  return Array.from({ length: count }, (_, i) => {
    hash = Math.imul(hash ^ (i + 1), 16777619);
    return 22 + Math.abs(hash % 58);
  });
}

async function dataUrlFromBlob(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function readAudioDuration(file: File) {
  const objectUrl = URL.createObjectURL(file);
  try {
    return await new Promise<number>((resolve) => {
      const audio = new Audio();
      audio.preload = "metadata";
      audio.onloadedmetadata = () => resolve(Number.isFinite(audio.duration) ? audio.duration : 0);
      audio.onerror = () => resolve(0);
      audio.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

type AudioLayerPlayerProps = {
  id: string;
  layer: Layer;
  selected: boolean;
  readOnly?: boolean;
  boardId?: string;
};

export function AudioLayerPlayer({ id, layer, selected, readOnly, boardId }: AudioLayerPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(layer.audioDuration || 0);
  const [titleDraft, setTitleDraft] = useState(layer.value || "Note vocale");
  const [replacing, setReplacing] = useState(false);
  const updateLayer = useCanvasStore((s) => s.updateLayer);
  const compact = layer.height < 96;
  const effectiveDuration = Math.max(duration || layer.audioDuration || 0, 0);
  const trimStart = clamp(layer.audioTrimStart ?? 0, 0, effectiveDuration || 0);
  const trimEnd = clamp(layer.audioTrimEnd ?? effectiveDuration, trimStart || 0, effectiveDuration || trimStart || 0);
  const bars = useMemo(() => seededBars(`${id}:${layer.src || ""}`, compact ? 28 : 40), [id, layer.src, compact]);

  useEffect(() => {
    setTitleDraft(layer.value || "Note vocale");
  }, [layer.value]);

  useEffect(() => {
    setDuration(layer.audioDuration || 0);
    setCurrent(layer.audioTrimStart || 0);
    setPlaying(false);
  }, [layer.src, layer.audioDuration, layer.audioTrimStart]);

  const uploadReplacement = async (blob: Blob, durationSec: number, name: string, toastId?: string | number) => {
    const activeToast = toastId ?? toast.loading("Remplacement de la note vocale...");
    setReplacing(true);
    try {
      const data = await dataUrlFromBlob(blob);
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name,
          type: blob.type || "audio/webm",
          size: blob.size,
          data,
          boardId,
        }),
      });
      if (!res.ok) throw new Error("upload failed");
      const { url } = (await res.json()) as { url: string };
      updateLayer(
        id,
        {
          src: url,
          audioDuration: durationSec,
          audioTrimStart: 0,
          audioTrimEnd: durationSec,
        },
        { history: true },
      );
      toast.success("Note vocale remplacée", { id: activeToast });
    } catch {
      toast.error("Échec du remplacement audio", { id: activeToast });
    } finally {
      setReplacing(false);
    }
  };

  const voice = useVoiceRecorder((blob, durationSec) =>
    uploadReplacement(blob, durationSec, `note-vocale-${Date.now()}.webm`),
  );

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audio || !layer.src) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    if (audio.currentTime < trimStart || audio.currentTime >= trimEnd) audio.currentTime = trimStart;
    void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  };

  const seek = (value: number) => {
    const audio = audioRef.current;
    const next = clamp(value, trimStart, trimEnd || effectiveDuration);
    if (audio) audio.currentTime = next;
    setCurrent(next);
  };

  const updateTrim = (patch: Partial<Layer>) => {
    updateLayer(id, patch);
  };

  const beginTrimBatch = (key: string) => {
    useCanvasStore.getState().beginHistoryBatch(key);
  };

  const endTrimBatch = (key: string) => {
    useCanvasStore.getState().endHistoryBatch(key);
  };

  const onFileReplace = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const durationSec = await readAudioDuration(file);
    await uploadReplacement(file, durationSec || effectiveDuration, file.name);
  };

  return (
    <div
      className="flex h-full w-full flex-col gap-1.5 border border-neutral-200 bg-white px-3 py-2 shadow-sm dark:border-neutral-700 dark:bg-neutral-900"
      style={{ borderRadius: layer.cornerRadius || 12 }}
    >
      <audio
        ref={audioRef}
        src={layer.src}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const nextDuration = Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : layer.audioDuration || 0;
          setDuration(nextDuration);
          if (!layer.audioTrimEnd && nextDuration) updateLayer(id, { audioTrimEnd: nextDuration });
        }}
        onTimeUpdate={(e) => {
          const next = e.currentTarget.currentTime;
          if (trimEnd && next >= trimEnd) {
            e.currentTarget.pause();
            e.currentTarget.currentTime = trimEnd;
            setPlaying(false);
            setCurrent(trimEnd);
            return;
          }
          setCurrent(next);
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 transition hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300"
          onClick={togglePlayback}
          onPointerDown={(e) => e.stopPropagation()}
          title={playing ? "Pause" : "Lire"}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <div className="min-w-0 flex-1">
          {selected && !readOnly ? (
            <input
              value={titleDraft}
              onFocus={() => useCanvasStore.getState().beginHistoryBatch(`audio-title:${id}`)}
              onBlur={() => useCanvasStore.getState().endHistoryBatch(`audio-title:${id}`)}
              onPointerDown={(e) => e.stopPropagation()}
              onChange={(e) => {
                setTitleDraft(e.target.value);
                updateLayer(id, { value: e.target.value });
              }}
              className="h-5 w-full rounded border border-transparent bg-transparent px-1 text-[11px] font-semibold text-neutral-700 outline-none focus:border-neutral-300 dark:text-neutral-200 dark:focus:border-neutral-600"
              spellCheck={false}
            />
          ) : (
            <div className="truncate text-[11px] font-semibold text-neutral-700 dark:text-neutral-200">
              {layer.value || "Note vocale"}
            </div>
          )}
          <div className="text-[10px] tabular-nums text-neutral-500">
            {formatTime(current)} / {formatTime(effectiveDuration)}
          </div>
        </div>
        {selected && !readOnly && !compact && (
          <div className="flex shrink-0 items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
            {voice.active ? (
              <>
                <button
                  type="button"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950/40"
                  onClick={voice.stop}
                  title="Terminer le réenregistrement"
                >
                  <CircleStop className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                  onClick={voice.cancel}
                  title="Annuler"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white"
                  onClick={() => void voice.start().catch(() => toast.error("Micro indisponible"))}
                  disabled={replacing}
                  title="Réenregistrer"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={replacing}
                  title="Remplacer par un fichier audio"
                >
                  <Upload className="h-3.5 w-3.5" />
                </button>
              </>
            )}
            <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={onFileReplace} />
          </div>
        )}
      </div>

      <button
        type="button"
        className="group relative flex h-7 w-full items-center gap-0.5 overflow-hidden rounded bg-neutral-50 px-1 dark:bg-neutral-800/80"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const ratio = (e.clientX - rect.left) / Math.max(rect.width, 1);
          seek(trimStart + ratio * Math.max(trimEnd - trimStart, 0));
        }}
        title="Waveform"
      >
        <div
          className="absolute inset-y-0 bg-red-500/10"
          style={{
            left: `${effectiveDuration ? (trimStart / effectiveDuration) * 100 : 0}%`,
            width: `${effectiveDuration ? ((trimEnd - trimStart) / effectiveDuration) * 100 : 100}%`,
          }}
        />
        <div
          className="absolute bottom-0 top-0 w-px bg-red-500"
          style={{ left: `${effectiveDuration ? (current / effectiveDuration) * 100 : 0}%` }}
        />
        {bars.map((height, index) => (
          <span
            key={index}
            className="relative flex-1 rounded-full bg-neutral-300 transition-colors group-hover:bg-red-300 dark:bg-neutral-600"
            style={{ height: `${height}%` }}
          />
        ))}
      </button>

      {!compact && (
        <input
          type="range"
          min={trimStart}
          max={trimEnd || effectiveDuration || 1}
          step="0.1"
          value={clamp(current, trimStart, trimEnd || effectiveDuration || 1)}
          className="h-1 w-full accent-red-500"
          onPointerDown={(e) => e.stopPropagation()}
          onChange={(e) => seek(Number(e.target.value))}
        />
      )}

      {selected && !readOnly && !compact && (
        <div className="grid grid-cols-2 gap-2 text-[10px] text-neutral-500" onPointerDown={(e) => e.stopPropagation()}>
          <label className="space-y-0.5">
            <span>Début {formatTime(trimStart)}</span>
            <input
              type="range"
              min={0}
              max={effectiveDuration || 1}
              step="0.1"
              value={trimStart}
              className="h-1 w-full accent-red-500"
              onPointerDown={() => beginTrimBatch(`audio-trim:${id}`)}
              onPointerUp={() => endTrimBatch(`audio-trim:${id}`)}
              onPointerCancel={() => endTrimBatch(`audio-trim:${id}`)}
              onChange={(e) => {
                const next = clamp(Number(e.target.value), 0, trimEnd);
                updateTrim({ audioTrimStart: next });
                if (current < next) seek(next);
              }}
            />
          </label>
          <label className="space-y-0.5">
            <span>Fin {formatTime(trimEnd)}</span>
            <input
              type="range"
              min={0}
              max={effectiveDuration || 1}
              step="0.1"
              value={trimEnd}
              className="h-1 w-full accent-red-500"
              onPointerDown={() => beginTrimBatch(`audio-trim:${id}`)}
              onPointerUp={() => endTrimBatch(`audio-trim:${id}`)}
              onPointerCancel={() => endTrimBatch(`audio-trim:${id}`)}
              onChange={(e) => {
                const next = clamp(Number(e.target.value), trimStart, effectiveDuration || trimStart);
                updateTrim({ audioTrimEnd: next });
                if (current > next) seek(next);
              }}
            />
          </label>
        </div>
      )}

      {voice.active && (
        <div className="pointer-events-none absolute -bottom-7 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-red-500 px-2 py-1 text-[10px] font-semibold text-white shadow-lg">
          <Mic className="h-3 w-3" />
          {formatTime(voice.elapsed)}
        </div>
      )}
    </div>
  );
}
