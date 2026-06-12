import { useEffect, useState } from "react";
import { ImageIcon, Link2 } from "lucide-react";

type PasteGhostProps = {
  kind: "image" | "link" | "layer" | null;
  label?: string;
};

export function PasteGhost({ kind, label }: PasteGhostProps) {
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!kind) return;
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setPos({ x: e.clientX, y: e.clientY }));
    };
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [kind]);

  if (!kind) return null;

  return (
    <div
      className="fixed z-[9998] pointer-events-none paste-ghost"
      style={{ transform: `translate(${pos.x + 16}px, ${pos.y + 16}px)` }}
    >
      <div className="flex items-center gap-2 rounded-xl border border-blue-200/80 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md px-3 py-2 shadow-lg">
        {kind === "image" ? <ImageIcon className="h-4 w-4 text-blue-600" /> : <Link2 className="h-4 w-4 text-blue-600" />}
        <span className="text-xs font-medium text-neutral-700 dark:text-neutral-200 max-w-[180px] truncate">
          {label || (kind === "image" ? "Image prête à coller" : kind === "layer" ? "Éléments prêts à coller" : "Lien prêt à coller")}
        </span>
      </div>
    </div>
  );
}
