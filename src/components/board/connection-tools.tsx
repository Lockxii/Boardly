import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, Link2, Minus, ArrowRight, Circle, Spline, MoveHorizontal, X } from "lucide-react";
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
  const dismissConnectionTools = useCanvasStore((s) => s.dismissConnectionTools);
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
      useCanvasStore.getState().pushHistory();
      updateConnection(selectedConnectionId, updates);
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="connection-tools"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
          className="absolute top-22 left-1/2 z-[60] flex -translate-x-1/2 flex-nowrap items-center gap-0.5 rounded-lg border border-neutral-200 bg-white px-1.5 py-1 shadow-xl pointer-events-auto dark:border-neutral-700 dark:bg-neutral-800 max-w-[min(96vw,920px)] overflow-x-auto no-scrollbar"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-center gap-1 px-1 text-xs font-medium text-neutral-500">
            <Link2 className="h-3.5 w-3.5 text-blue-500" />
            <span className="hidden sm:inline">{connectFromId ? "Relier" : "Connecteur"}</span>
          </div>

          <Sep />

          {ROUTINGS.map(({ id, label, icon: Icon }) => (
            <Button
              key={id}
              variant="ghost"
              size="icon"
              className={`h-7 w-7 shrink-0 ${style.routing === id ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40" : ""}`}
              title={label}
              onClick={() => applyStyle({ routing: id })}
            >
              <Icon className="h-3.5 w-3.5" />
            </Button>
          ))}

          <Sep />

          {LINE_STYLES.map(({ id, label }) => (
            <Button
              key={id}
              variant="ghost"
              size="sm"
              className={`h-7 shrink-0 px-2 text-[11px] ${style.lineStyle === id ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40" : ""}`}
              title={label}
              onClick={() => applyStyle({ lineStyle: id })}
            >
              {label}
            </Button>
          ))}

          <Sep />

          {MARKERS.map(({ id, label, icon: Icon }) => (
            <Button
              key={`start-${id}`}
              variant="ghost"
              size="icon"
              className={`h-7 w-7 shrink-0 ${style.arrowStart === id ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40" : ""}`}
              title={`Début: ${label}`}
              onClick={() => applyStyle({ arrowStart: id })}
            >
              <Icon className="h-3 w-3" />
            </Button>
          ))}

          <span className="shrink-0 text-neutral-300 dark:text-neutral-600">→</span>

          {MARKERS.map(({ id, label, icon: Icon }) => (
            <Button
              key={`end-${id}`}
              variant="ghost"
              size="icon"
              className={`h-7 w-7 shrink-0 ${style.arrowEnd === id ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40" : ""}`}
              title={`Fin: ${label}`}
              onClick={() => applyStyle({ arrowEnd: id })}
            >
              <Icon className="h-3 w-3" />
            </Button>
          ))}

          <Sep />

          <input
            type="color"
            value={style.stroke}
            onChange={(e) => applyStyle({ stroke: e.target.value })}
            className="h-7 w-7 shrink-0 cursor-pointer rounded border border-neutral-200 bg-transparent p-0.5 dark:border-neutral-600"
            title="Couleur"
          />

          <input
            type="range"
            min={1}
            max={6}
            step={1}
            value={style.strokeWidth}
            onChange={(e) => applyStyle({ strokeWidth: Number(e.target.value) })}
            className="h-7 w-14 shrink-0 accent-blue-600"
            title="Épaisseur"
          />

          {selectedConnectionId && (
            <>
              <Sep />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                title="Supprimer le connecteur"
                onClick={() => removeConnection(selectedConnectionId)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}

          <Sep />

          <Button
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 gap-1 px-2 text-[11px] text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-700"
            title="Fermer (Échap ou V)"
            onClick={() => dismissConnectionTools()}
          >
            <X className="h-3.5 w-3.5" />
            <span className="hidden md:inline">{connectFromId ? "Annuler" : "Fermer"}</span>
            <kbd className="hidden lg:inline rounded border border-neutral-200 bg-neutral-50 px-1 font-mono text-[9px] dark:border-neutral-600 dark:bg-neutral-900">
              Esc
            </kbd>
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

function Sep() {
  return <div className="mx-0.5 h-5 w-px shrink-0 bg-neutral-200 dark:bg-neutral-700" />;
}
