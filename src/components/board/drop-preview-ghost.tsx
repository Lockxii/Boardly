import { useEffect, useState } from "react";
import { Link2, FileImage } from "lucide-react";

type DropPreviewGhostProps = {
  kind: "images" | "urls" | "mixed";
  previews: string[];
  label: string;
  x: number;
  y: number;
};

export function DropPreviewGhost({ kind, previews, label, x, y }: DropPreviewGhostProps) {
  const [pos, setPos] = useState({ x, y });

  useEffect(() => {
    setPos({ x, y });
  }, [x, y]);

  return (
    <div
      className="fixed z-[9999] pointer-events-none paste-ghost"
      style={{ transform: `translate(${pos.x + 20}px, ${pos.y + 20}px)` }}
    >
      <div className="rounded-2xl border border-blue-300/80 bg-white/95 p-2 shadow-2xl backdrop-blur-md dark:border-blue-500/40 dark:bg-neutral-900/95">
        {previews.length > 0 ? (
          <div className="flex items-center gap-1.5">
            {previews.slice(0, 3).map((src, i) => (
              <div
                key={src}
                className="relative h-16 w-16 overflow-hidden rounded-lg border border-neutral-200/80 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800"
                style={{ transform: `rotate(${(i - 1) * 4}deg)` }}
              >
                <img src={src} alt="" className="h-full w-full object-cover" draggable={false} />
              </div>
            ))}
            {previews.length > 3 && (
              <span className="rounded-full bg-blue-600 px-2 py-1 text-[10px] font-semibold text-white">
                +{previews.length - 3}
              </span>
            )}
          </div>
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/40">
            {kind === "urls" ? (
              <Link2 className="h-7 w-7 text-blue-600" />
            ) : (
              <FileImage className="h-7 w-7 text-blue-600" />
            )}
          </div>
        )}
        <p className="mt-2 max-w-[200px] truncate text-center text-xs font-medium text-neutral-700 dark:text-neutral-200">
          {label}
        </p>
      </div>
    </div>
  );
}
