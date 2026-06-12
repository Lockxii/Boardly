import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X, Presentation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCanvasStore } from "@/store/canvas-store";
import { focusCameraOnLayer, getPresentationSlides } from "@/lib/presentation-utils";
import { motion, AnimatePresence } from "framer-motion";

type PresentationModeProps = {
  open: boolean;
  onClose: () => void;
};

export function PresentationMode({ open, onClose }: PresentationModeProps) {
  const layerIds = useCanvasStore((s) => s.layerIds);
  const layers = useCanvasStore((s) => s.layers);
  const setCamera = useCanvasStore((s) => s.setCamera);
  const setSelection = useCanvasStore((s) => s.setSelection);
  const [index, setIndex] = useState(0);

  const slides = useMemo(() => getPresentationSlides(layerIds, layers), [layerIds, layers]);

  const goTo = useCallback(
    (nextIndex: number) => {
      if (slides.length === 0) return;
      const clamped = Math.max(0, Math.min(nextIndex, slides.length - 1));
      setIndex(clamped);
      const slide = slides[clamped];
      setSelection([slide.id]);
      setCamera(focusCameraOnLayer(slide.layer));
    },
    [slides, setCamera, setSelection],
  );

  useEffect(() => {
    if (!open) return;
    setIndex(0);
    if (slides.length > 0) {
      setSelection([slides[0].id]);
      setCamera(focusCameraOnLayer(slides[0].layer));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reset when opening
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        goTo(index + 1);
      }
      if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        goTo(index - 1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, index, goTo, onClose]);

  if (!open) return null;

  const current = slides[index];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] pointer-events-none"
      >
        <div className="absolute inset-0 bg-black/15 dark:bg-black/35" />

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-auto">
          <div className="flex items-center gap-2 rounded-2xl border border-neutral-200/80 bg-white/95 px-3 py-2 shadow-xl backdrop-blur-md dark:border-neutral-700/80 dark:bg-neutral-900/95">
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => goTo(index - 1)} disabled={index <= 0}>
              <ChevronLeft className="h-5 w-5" />
            </Button>

            <div className="flex min-w-[140px] flex-col items-center px-2">
              <span className="flex items-center gap-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-300">
                <Presentation className="h-3.5 w-3.5" />
                Présentation
              </span>
              <span className="font-mono text-sm tabular-nums text-neutral-800 dark:text-neutral-100">
                {slides.length === 0 ? "0 / 0" : `${index + 1} / ${slides.length}`}
              </span>
              {current && (
                <span className="max-w-[220px] truncate text-[10px] text-neutral-500">
                  {current.layer.linkTitle || current.layer.value || current.layer.type}
                </span>
              )}
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => goTo(index + 1)}
              disabled={index >= slides.length - 1}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>

            <div className="mx-1 h-6 w-px bg-neutral-200 dark:bg-neutral-700" />

            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onClose} title="Quitter (Échap)">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {slides.length === 0 && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto rounded-xl bg-white/95 px-6 py-4 text-center shadow-lg dark:bg-neutral-900/95">
            <p className="text-sm text-neutral-600 dark:text-neutral-300">Aucun élément à présenter sur ce board.</p>
            <Button variant="ghost" size="sm" className="mt-2" onClick={onClose}>
              Fermer
            </Button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
