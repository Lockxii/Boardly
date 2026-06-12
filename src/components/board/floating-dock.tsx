import { memo, useCallback, useEffect, useRef, useState, createContext, useContext, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, GripVertical, GripHorizontal } from "lucide-react";
import {
  type DockAnchor,
  type DockState,
  dockAnchorClasses,
  isVerticalDock,
  loadDockState,
  saveDockState,
  snapPointerToAnchor,
} from "@/lib/floating-dock";

const FloatingDockContext = createContext({ vertical: false });

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
};

export const FloatingDock = memo(function FloatingDock({
  id,
  defaultAnchor,
  children,
  collapsedContent,
  className = "",
  innerClassName = "",
  zIndex = 20,
}: FloatingDockProps) {
  const [state, setState] = useState<DockState>(() => loadDockState(id, defaultAnchor));
  const [dragging, setDragging] = useState(false);
  const [dragPoint, setDragPoint] = useState({ x: 0, y: 0 });
  const dragOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    saveDockState(id, state);
  }, [id, state]);

  const vertical = isVerticalDock(state.anchor);

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
      const anchor = snapPointerToAnchor(
        e.clientX,
        e.clientY,
        window.innerWidth,
        window.innerHeight,
      );
      setState((prev) => ({ ...prev, anchor }));
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    [dragging],
  );

  const toggleCollapsed = useCallback(() => {
    setState((prev) => ({ ...prev, collapsed: !prev.collapsed }));
  }, []);

  const collapseIcon = (() => {
    if (state.collapsed) {
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

  const dockPositionClass = dragging ? "" : dockAnchorClasses(state.anchor);

  const panelStyle: React.CSSProperties = dragging
    ? {
        position: "fixed",
        left: dragPoint.x - dragOffset.current.x,
        top: dragPoint.y - dragOffset.current.y,
        zIndex: zIndex + 10,
        width: "max-content",
        maxWidth: "calc(100vw - 2rem)",
      }
    : { zIndex };

  return (
    <FloatingDockContext.Provider value={{ vertical }}>
    <motion.div
      ref={panelRef}
      layout
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className={`absolute pointer-events-auto ${dragging ? "" : dockPositionClass} ${className}`}
      style={panelStyle}
    >
      <div
        className={`flex items-center gap-1 rounded-xl border border-neutral-200/70 bg-white/90 shadow-sm shadow-black/[0.06] backdrop-blur-md dark:border-neutral-700/70 dark:bg-neutral-900/90 ${
          vertical ? "flex-col py-1.5 px-1" : "flex-row px-1.5 py-1"
        } ${state.collapsed ? "" : innerClassName}`}
      >
        <button
          type="button"
          className={`flex shrink-0 cursor-grab items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 active:cursor-grabbing dark:hover:bg-neutral-800 dark:hover:text-neutral-200 ${
            vertical ? "h-6 w-8" : "h-8 w-6"
          }`}
          title="Déplacer"
          onPointerDown={startDrag}
          onPointerMove={onDragMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {vertical ? <GripHorizontal className="h-4 w-4" /> : <GripVertical className="h-4 w-4" />}
        </button>

        <AnimatePresence mode="wait" initial={false}>
          {state.collapsed ? (
            <motion.button
              key="collapsed"
              type="button"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.12 }}
              className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800 ${
                vertical ? "flex-col" : "flex-row"
              }`}
              onClick={toggleCollapsed}
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
              className={`flex min-w-0 items-center gap-1 ${vertical ? "flex-col" : "flex-row"} ${
                state.anchor === "top-center" && !vertical ? "w-full flex-1" : ""
              }`}
            >
              {children}
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="button"
          className={`flex shrink-0 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 ${
            vertical ? "h-6 w-8" : "h-8 w-6"
          }`}
          title={state.collapsed ? "Déplier" : "Replier"}
          onClick={toggleCollapsed}
        >
          {collapseIcon}
        </button>
      </div>
    </motion.div>
    </FloatingDockContext.Provider>
  );
});
