import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, Link2, Minus, ArrowRight, Circle, Spline, MoveHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCanvasStore } from "@/store/canvas-store";
import type { ConnectionLineStyle, ConnectionMarker, ConnectionRouting } from "@/lib/connection-utils";

const LINE_STYLES: { id: ConnectionLineStyle; label: string }[] = [
  { id: "solid", label: "Plein" },
  { id: "dashed", label: "Tirets" },
  { id: "dotted", label: "Points" },
];

const MARKERS: { id: ConnectionMarker; label: string; icon: typeof ArrowRight }[] = [
  { id: "none", label: "Aucun", icon: Minus },
  { id: "arrow", label: "Flèche", icon: ArrowRight },
  { id: "dot", label: "Point", icon: Circle },
];

const ROUTINGS: { id: ConnectionRouting; label: string; icon: typeof Spline }[] = [
  { id: "bezier", label: "Courbe", icon: Spline },
  { id: "straight", label: "Droit", icon: MoveHorizontal },
];

export const ConnectionTools = memo(function ConnectionTools() {
  const connectFromId = useCanvasStore((s) => s.connectFromId);
  const selectedConnectionId = useCanvasStore((s) => s.selectedConnectionId);
  const connections = useCanvasStore((s) => s.connections);
  const connectionDefaults = useCanvasStore((s) => s.connectionDefaults);
  const setConnectionDefaults = useCanvasStore((s) => s.setConnectionDefaults);
  const updateConnection = useCanvasStore((s) => s.updateConnection);
  const removeConnection = useCanvasStore((s) => s.removeConnection);
  const readOnly = useCanvasStore((s) => s.readOnly);

  const visible = !readOnly && (!!connectFromId || !!selectedConnectionId);
  const selected = selectedConnectionId ? connections.find((c) => c.id === selectedConnectionId) : null;

  const style = selected
    ? {
        stroke: selected.stroke || connectionDefaults.stroke,
        strokeWidth: selected.strokeWidth || connectionDefaults.strokeWidth,
        lineStyle: selected.lineStyle || connectionDefaults.lineStyle,
        arrowStart: selected.arrowStart ?? connectionDefaults.arrowStart,
        arrowEnd: selected.arrowEnd ?? connectionDefaults.arrowEnd,
        routing: selected.routing || connectionDefaults.routing,
      }
    : connectionDefaults;

  const applyStyle = (updates: Partial<typeof style>) => {
    setConnectionDefaults(updates);
    if (selectedConnectionId) {
      updateConnection(selectedConnectionId, updates);
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="connection-tools"
          initial={{ opacity: 0, y: -8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 420, damping: 28 }}
          className="absolute top-22 left-1/2 z-50 flex -translate-x-1/2 flex-wrap items-center gap-1 rounded-lg border border-neutral-200 bg-white p-1.5 shadow-xl pointer-events-auto dark:border-neutral-700 dark:bg-neutral-800 max-w-[95vw]"
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="flex items-center gap-1.5 px-1 text-xs font-medium text-neutral-500">
            <Link2 className="h-3.5 w-3.5 text-blue-500" />
            {connectFromId ? "Style du lien" : "Connecteur"}
          </div>

          <div className="mx-1 h-6 w-px bg-neutral-200 dark:bg-neutral-700" />

          <div className="flex items-center gap-0.5">
            {ROUTINGS.map(({ id, label, icon: Icon }) => (
              <Button
                key={id}
                variant="ghost"
                size="icon"
                className={`h-8 w-8 ${style.routing === id ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40" : ""}`}
                title={label}
                onClick={() => applyStyle({ routing: id })}
              >
                <Icon className="h-4 w-4" />
              </Button>
            ))}
          </div>

          <div className="mx-1 h-6 w-px bg-neutral-200 dark:bg-neutral-700" />

          <div className="flex items-center gap-0.5">
            {LINE_STYLES.map(({ id, label }) => (
              <Button
                key={id}
                variant="ghost"
                size="sm"
                className={`h-8 px-2 text-xs ${style.lineStyle === id ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40" : ""}`}
                onClick={() => applyStyle({ lineStyle: id })}
              >
                {label}
              </Button>
            ))}
          </div>

          <div className="mx-1 h-6 w-px bg-neutral-200 dark:bg-neutral-700" />

          <div className="flex items-center gap-1 px-1">
            <span className="text-[10px] uppercase tracking-wide text-neutral-400">Début</span>
            {MARKERS.map(({ id, label, icon: Icon }) => (
              <Button
                key={`start-${id}`}
                variant="ghost"
                size="icon"
                className={`h-8 w-8 ${style.arrowStart === id ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40" : ""}`}
                title={`Début: ${label}`}
                onClick={() => applyStyle({ arrowStart: id })}
              >
                <Icon className="h-3.5 w-3.5" />
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-1 px-1">
            <span className="text-[10px] uppercase tracking-wide text-neutral-400">Fin</span>
            {MARKERS.map(({ id, label, icon: Icon }) => (
              <Button
                key={`end-${id}`}
                variant="ghost"
                size="icon"
                className={`h-8 w-8 ${style.arrowEnd === id ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40" : ""}`}
                title={`Fin: ${label}`}
                onClick={() => applyStyle({ arrowEnd: id })}
              >
                <Icon className="h-3.5 w-3.5" />
              </Button>
            ))}
          </div>

          <div className="mx-1 h-6 w-px bg-neutral-200 dark:bg-neutral-700" />

          <input
            type="color"
            value={style.stroke}
            onChange={(e) => applyStyle({ stroke: e.target.value })}
            className="h-8 w-8 cursor-pointer rounded border border-neutral-200 bg-transparent p-0.5 dark:border-neutral-600"
            title="Couleur"
          />

          <input
            type="range"
            min={1}
            max={6}
            step={1}
            value={style.strokeWidth}
            onChange={(e) => applyStyle({ strokeWidth: Number(e.target.value) })}
            className="h-8 w-16 accent-blue-600"
            title="Épaisseur"
          />

          {selectedConnectionId && (
            <>
              <div className="mx-1 h-6 w-px bg-neutral-200 dark:bg-neutral-700" />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                title="Supprimer le connecteur"
                onClick={() => removeConnection(selectedConnectionId)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
});
