import { useEffect, useState } from "react";
import { Timer, Play, Pause, RotateCcw, Zap, X, GripVertical } from "lucide-react";
import { useCanvasStore } from "@/store/canvas-store";
import { cursorColorForUser, type TimerEventPayload } from "@/lib/board-socket";
import { getInitials } from "@/lib/utils";
import { useDraggable } from "@/lib/use-draggable";

const PRESET_MINUTES = [1, 3, 5, 10];

function formatMs(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function sendTimer(timer: TimerEventPayload) {
  useCanvasStore.getState().liveActions?.sendTimer(timer);
}

function TimerWidget() {
  const liveTimer = useCanvasStore((s) => s.liveTimer);
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  const [customMin, setCustomMin] = useState("");

  const running = !!liveTimer && liveTimer.endsAt !== null && !liveTimer.paused;

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [running]);

  const start = (minutes: number) => {
    const durationMs = minutes * 60_000;
    sendTimer({ endsAt: Date.now() + durationMs, paused: false, remainingMs: durationMs, durationMs });
    setOpen(false);
  };
  const pause = () => {
    if (!liveTimer || liveTimer.endsAt === null) return;
    sendTimer({ endsAt: null, paused: true, remainingMs: Math.max(0, liveTimer.endsAt - Date.now()), durationMs: liveTimer.durationMs });
  };
  const resume = () => {
    if (!liveTimer) return;
    sendTimer({ endsAt: Date.now() + liveTimer.remainingMs, paused: false, remainingMs: liveTimer.remainingMs, durationMs: liveTimer.durationMs });
  };
  const reset = () => sendTimer({ endsAt: null, paused: false, remainingMs: 0, durationMs: 0 });

  if (!liveTimer) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 rounded-full border border-neutral-200/80 bg-white/90 px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur transition-colors hover:bg-neutral-50 dark:border-neutral-700/80 dark:bg-neutral-900/90 dark:hover:bg-neutral-800"
        >
          <Timer className="h-3.5 w-3.5" /> Minuteur
        </button>
        {open && (
          <div className="absolute right-0 top-full mt-1.5 flex flex-col gap-1.5 rounded-xl border border-neutral-200/80 bg-white p-1.5 shadow-lg dark:border-neutral-700/80 dark:bg-neutral-900">
            <div className="flex gap-1">
              {PRESET_MINUTES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => start(m)}
                  className="rounded-lg px-2.5 py-1 text-xs font-medium hover:bg-blue-50 dark:hover:bg-blue-950/40"
                >
                  {m}m
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const m = Math.min(180, Math.max(1, Math.round(Number(customMin))));
                if (m > 0) {
                  start(m);
                  setCustomMin("");
                }
              }}
              className="flex items-center gap-1 border-t border-neutral-100 pt-1.5 dark:border-neutral-800"
            >
              <input
                type="number"
                min={1}
                max={180}
                value={customMin}
                onChange={(e) => setCustomMin(e.target.value)}
                placeholder="min"
                className="w-14 rounded-lg border border-neutral-200 bg-transparent px-2 py-1 text-xs outline-none dark:border-neutral-700"
              />
              <button type="submit" className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700">
                Démarrer
              </button>
            </form>
          </div>
        )}
      </div>
    );
  }

  const remaining = liveTimer.paused
    ? liveTimer.remainingMs
    : liveTimer.endsAt !== null
      ? liveTimer.endsAt - now
      : 0;
  const done = !liveTimer.paused && remaining <= 0;

  return (
    <div className="flex items-center gap-1.5 rounded-full border border-neutral-200/80 bg-white/90 px-2 py-1 shadow-sm backdrop-blur dark:border-neutral-700/80 dark:bg-neutral-900/90">
      <span className={`min-w-[44px] text-center text-sm font-semibold tabular-nums ${done ? "animate-pulse text-red-500" : ""}`}>
        {formatMs(Math.max(0, remaining))}
      </span>
      {liveTimer.paused ? (
        <button type="button" onClick={resume} aria-label="Reprendre" className="rounded-full p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800">
          <Play className="h-3.5 w-3.5" />
        </button>
      ) : (
        <button type="button" onClick={pause} aria-label="Pause" className="rounded-full p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800">
          <Pause className="h-3.5 w-3.5" />
        </button>
      )}
      <button type="button" onClick={reset} aria-label="Réinitialiser" className="rounded-full p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800">
        <RotateCcw className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function PresenceBar() {
  const livePeers = useCanvasStore((s) => s.livePeers);
  const followingUserId = useCanvasStore((s) => s.followingUserId);
  const setFollowingUserId = useCanvasStore((s) => s.setFollowingUserId);
  const [laserOn, setLaserOn] = useState(false);

  // One avatar per user (a user may have several connections).
  const peers = Array.from(new Map(livePeers.map((p) => [p.userId, p])).values());
  if (peers.length === 0) return null;

  const toggleLaser = () => {
    const next = !laserOn;
    setLaserOn(next);
    useCanvasStore.getState().liveActions?.setLaser(next);
  };

  return (
    <div className="flex items-center gap-1.5 rounded-full border border-neutral-200/80 bg-white/90 px-2 py-1 shadow-sm backdrop-blur dark:border-neutral-700/80 dark:bg-neutral-900/90">
      <div className="flex -space-x-1.5">
        {peers.slice(0, 6).map((p) => {
          const following = followingUserId === p.userId;
          return (
            <button
              key={p.userId}
              type="button"
              onClick={() => setFollowingUserId(following ? null : p.userId)}
              title={following ? `Arrêter de suivre ${p.userName}` : `Suivre ${p.userName}`}
              className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-white ring-2 transition-transform hover:scale-110 ${following ? "ring-blue-500" : "ring-white dark:ring-neutral-900"}`}
              style={{ backgroundColor: cursorColorForUser(p.userId) }}
            >
              {getInitials(p.userName)}
            </button>
          );
        })}
      </div>
      {followingUserId && (
        <button
          type="button"
          onClick={() => setFollowingUserId(null)}
          title="Arrêter de suivre"
          className="flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-600 dark:text-blue-400"
        >
          Suivi <X className="h-3 w-3" />
        </button>
      )}
      <button
        type="button"
        onClick={toggleLaser}
        title="Pointeur laser"
        className={`rounded-full p-1.5 transition-colors ${laserOn ? "bg-red-500 text-white" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}
      >
        <Zap className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/** Live-collaboration controls: shared timer + presence/follow + laser. */
export function CollabTools() {
  const drag = useDraggable<HTMLDivElement>({ storageKey: "collab-tools" });
  return (
    <div ref={drag.ref} style={drag.style} className="pointer-events-auto fixed right-4 top-20 z-40 flex flex-col items-end gap-2">
      <button
        {...drag.handleProps}
        type="button"
        title="Déplacer"
        className="flex h-5 items-center rounded-full border border-neutral-200/80 bg-white/90 px-1.5 text-neutral-300 shadow-sm backdrop-blur hover:text-neutral-500 dark:border-neutral-700/80 dark:bg-neutral-900/90 dark:text-neutral-600"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <PresenceBar />
      <TimerWidget />
    </div>
  );
}
