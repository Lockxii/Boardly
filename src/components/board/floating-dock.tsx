import { memo, useCallback, useEffect, useRef, useState, createContext, useContext, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  GripHorizontal,
  AlignCenter,
  Minimize2,
  Maximize2,
} from "lucide-react";
import {
  type DockAnchor,
  type DockState,
  centerAnchor,
  clampDockPos,
  dockAnchorClasses,
  dockAnchorStyle,
  isVerticalDock,
  loadDockState,
  saveDockState,
} from "@/lib/floating-dock";

type FloatingDockContextValue = {
  vertical: boolean;
  compact: boolean;
  anchor: DockAnchor;
};

const FloatingDockContext = createContext<FloatingDockContextValue>({
  vertical: false,
  compact: true,
  anchor: "top-center",
});

export function useFloatingDock() {
  return useContext(FloatingDockContext);
}

type FloatingDockProps = {
  id: string;
  defaultAnchor: DockAnchor;
  children: ReactNode;
  collapsedContent?: ReactNode;
  className?: string;
  innerClassName?: string;
  zIndex?: number;
  /** compact = resserrer le contenu ; collapse = pill minimal */
  toggleMode?: "compact" | "collapse";
  defaultCompact?: boolean;
  allowCenterSnap?: boolean;
};

export const FloatingDock = memo(function FloatingDock({
  id,
  defaultAnchor,
  children,
  collapsedContent,
  className = "",
  innerClassName = "",
  zIndex = 20,
  toggleMode = "collapse",
  defaultCompact = false,
  allowCenterSnap = false,
}: FloatingDockProps) {
  const [state, setState] = useState<DockState>(() =>
    loadDockState(id, defaultAnchor, { compact: defaultCompact }),
  );
  const [dragging, setDragging] = useState(false);
  const [dragPoint, setDragPoint] = useState({ x: 0, y: 0 });
  const dragOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    saveDockState(id, state);
  }, [id, state]);

  const vertical = isVerticalDock(state.anchor);
  const isCompactMode = toggleMode === "compact";
  const hidden = !isCompactMode && state.collapsed;

  const startDrag = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setDragPoint({ x: e.clientX, y: e.clientY });
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onDragMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      setDragPoint({ x: e.clientX, y: e.clientY });
    },
    [dragging],
  );

  const endDrag = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      setDragging(false);
      const rect = panelRef.current?.getBoundingClientRect();
      const size = rect ? { w: rect.width, h: rect.height } : undefined;
      const pos = clampDockPos(
        { x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y },
        size,
      );
      setState((prev) => ({ ...prev, pos }));
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    [dragging],
  );

  const togglePanel = useCallback(() => {
    if (isCompactMode) {
      setState((prev) => ({ ...prev, compact: !prev.compact }));
    } else {
      setState((prev) => ({ ...prev, collapsed: !prev.collapsed }));
    }
  }, [isCompactMode]);

  const snapToCenter = useCallback(() => {
    setState((prev) => ({ ...prev, pos: null, anchor: centerAnchor(prev.anchor) }));
  }, []);

  const toggleIcon = (() => {
    if (isCompactMode) {
      return state.compact ? (
        <Maximize2 className="h-3.5 w-3.5" />
      ) : (
        <Minimize2 className="h-3.5 w-3.5" />
      );
    }
    if (hidden) {
      if (state.anchor.startsWith("top")) return <ChevronDown className="h-3.5 w-3.5" />;
      if (state.anchor.startsWith("bottom")) return <ChevronUp className="h-3.5 w-3.5" />;
      if (state.anchor === "left-center") return <ChevronRight className="h-3.5 w-3.5" />;
      return <ChevronLeft className="h-3.5 w-3.5" />;
    }
    if (state.anchor.startsWith("top")) return <ChevronUp className="h-3.5 w-3.5" />;
    if (state.anchor.startsWith("bottom")) return <ChevronDown className="h-3.5 w-3.5" />;
    if (state.anchor === "left-center") return <ChevronLeft className="h-3.5 w-3.5" />;
    return <ChevronRight className="h-3.5 w-3.5" />;
  })();

  const dockPositionClass = dragging || state.pos ? "" : dockAnchorClasses(state.anchor);

  const panelStyle: React.CSSProperties = dragging
    ? {
        position: "fixed",
        left: dragPoint.x - dragOffset.current.x,
        top: dragPoint.y - dragOffset.current.y,
        zIndex: zIndex + 10,
        width: "max-content",
        maxWidth: "calc(100vw - 2rem)",
      }
    : state.pos
      ? {
          position: "fixed",
          left: state.pos.x,
          top: state.pos.y,
          zIndex,
          width: "max-content",
          maxWidth: "calc(100vw - 2rem)",
        }
      : { zIndex, ...dockAnchorStyle(state.anchor) };

  return (
    <FloatingDockContext.Provider
      value={{ vertical, compact: state.compact, anchor: state.anchor }}
    >
      <motion.div
        ref={panelRef}
        layout
        transition={{ type: "spring", stiffness: 420, damping: 32 }}
        className={`absolute pointer-events-auto w-max ${dragging ? "" : dockPositionClass} ${className}`}
        style={panelStyle}
      >
        <div
          className={`flex items-center gap-0.5 rounded-xl border border-neutral-200/70 bg-white/90 shadow-sm shadow-black/[0.06] backdrop-blur-md dark:border-neutral-700/70 dark:bg-neutral-900/90 ${
            vertical ? "flex-col py-1 px-0.5" : "flex-row py-0.5 px-1"
          } ${hidden ? "" : innerClassName}`}
        >
          <button
            type="button"
            className={`flex shrink-0 cursor-grab items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 active:cursor-grabbing dark:hover:bg-neutral-800 dark:hover:text-neutral-200 ${
              vertical ? "h-5 w-7" : "h-7 w-5"
            }`}
            title="Déplacer"
            onPointerDown={startDrag}
            onPointerMove={onDragMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            {vertical ? <GripHorizontal className="h-3.5 w-3.5" /> : <GripVertical className="h-3.5 w-3.5" />}
          </button>

          {allowCenterSnap && !hidden && (
            <button
              type="button"
              className={`flex shrink-0 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 ${
                vertical ? "h-5 w-7" : "h-7 w-5"
              }`}
              title="Centrer"
              onClick={snapToCenter}
            >
              <AlignCenter className="h-3.5 w-3.5" />
            </button>
          )}

          <AnimatePresence mode="wait" initial={false}>
            {hidden ? (
              <motion.button
                key="collapsed"
                type="button"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.12 }}
                className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800 ${
                  vertical ? "flex-col" : "flex-row"
                }`}
                onClick={togglePanel}
                title="Déplier"
              >
                {collapsedContent}
              </motion.button>
            ) : (
              <motion.div
                key="expanded"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.12 }}
                className={`flex min-w-0 items-center ${vertical ? "flex-col gap-0.5" : "flex-row gap-0.5"}`}
              >
                {children}
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="button"
            className={`flex shrink-0 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 ${
              vertical ? "h-5 w-7" : "h-7 w-5"
            }`}
            title={
              isCompactMode
                ? state.compact
                  ? "Élargir"
                  : "Resserrer"
                : hidden
                  ? "Déplier"
                  : "Replier"
            }
            onClick={togglePanel}
          >
            {toggleIcon}
          </button>
        </div>
      </motion.div>
    </FloatingDockContext.Provider>
  );
});
