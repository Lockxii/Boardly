import { useCallback, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";

type Pos = { x: number; y: number };

function loadPos(storageKey?: string): Pos | null {
  if (!storageKey || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`boardly-drag-${storageKey}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Pos;
    if (typeof parsed?.x !== "number" || typeof parsed?.y !== "number") return null;
    // Clamp so the panel's grip is never stranded off-screen (e.g. after a
    // resize or a stale saved position).
    return {
      x: Math.min(Math.max(8, parsed.x), Math.max(8, window.innerWidth - 60)),
      y: Math.min(Math.max(8, parsed.y), Math.max(8, window.innerHeight - 40)),
    };
  } catch {
    /* ignore */
  }
  return null;
}

function clampToViewport(pos: Pos, size: { w: number; h: number }): Pos {
  const margin = 8;
  const maxX = Math.max(margin, window.innerWidth - size.w - margin);
  const maxY = Math.max(margin, window.innerHeight - size.h - margin);
  return {
    x: Math.min(Math.max(margin, pos.x), maxX),
    y: Math.min(Math.max(margin, pos.y), maxY),
  };
}

/**
 * Make any floating panel freely draggable by a handle.
 *
 * Spread `handleProps` onto the drag handle (e.g. a grip icon) and `style` onto
 * the panel root, and give the panel `ref`. Until the user drags, the panel
 * keeps its default CSS positioning (Tailwind classes). Once dragged it becomes
 * `position: fixed` at the chosen point. Position can persist via `storageKey`.
 */
export function useDraggable<T extends HTMLElement = HTMLDivElement>(options: { storageKey?: string } = {}) {
  const { storageKey } = options;
  const ref = useRef<T | null>(null);
  const offset = useRef<Pos>({ x: 0, y: 0 });
  const [pos, setPos] = useState<Pos | null>(() => loadPos(storageKey));
  const [dragging, setDragging] = useState(false);

  const onPointerDown = useCallback((e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    e.preventDefault();
    e.stopPropagation();
    offset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setPos({ x: rect.left, y: rect.top });
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback(
    (e: ReactPointerEvent) => {
      if (!dragging) return;
      const size = ref.current
        ? { w: ref.current.offsetWidth, h: ref.current.offsetHeight }
        : { w: 0, h: 0 };
      setPos(clampToViewport({ x: e.clientX - offset.current.x, y: e.clientY - offset.current.y }, size));
    },
    [dragging],
  );

  const endDrag = useCallback(
    (e: ReactPointerEvent) => {
      if (!dragging) return;
      setDragging(false);
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      if (storageKey) {
        setPos((current) => {
          if (current) {
            try {
              window.localStorage.setItem(`boardly-drag-${storageKey}`, JSON.stringify(current));
            } catch {
              /* ignore */
            }
          }
          return current;
        });
      }
    },
    [dragging, storageKey],
  );

  const style: CSSProperties = pos
    ? {
        position: "fixed",
        left: pos.x,
        top: pos.y,
        right: "auto",
        bottom: "auto",
        margin: 0,
        transform: "none",
      }
    : {};

  const handleProps = {
    onPointerDown,
    onPointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    style: { cursor: dragging ? "grabbing" : "grab", touchAction: "none" } as CSSProperties,
  };

  const reset = useCallback(() => setPos(null), []);

  return { ref, handleProps, style, dragging, reset, moved: pos !== null };
}
