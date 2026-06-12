import { Palette } from "lucide-react";
import { useCanvasStore } from "@/store/canvas-store";
import { NOTE_COLORS } from "@/lib/canvas-utils";

export function BrandPaletteBar() {
  const brandColors = useCanvasStore((s) => s.brandColors);
  const setBrandColors = useCanvasStore((s) => s.setBrandColors);
  const lastUsedColor = useCanvasStore((s) => s.lastUsedColor);
  const setLastUsedColor = useCanvasStore((s) => s.setLastUsedColor);
  const readOnly = useCanvasStore((s) => s.readOnly);

  if (readOnly) return null;

  return (
    <div className="absolute top-22 right-4 md:right-auto md:left-1/2 md:-translate-x-1/2 translate-y-12 flex items-center gap-1 px-2 py-1 bg-white/90 dark:bg-neutral-800/90 backdrop-blur rounded-lg border border-neutral-200 dark:border-neutral-700 shadow-sm z-40 pointer-events-auto">
      <Palette className="h-3.5 w-3.5 text-neutral-400 mr-1" />
      <span className="text-[10px] text-neutral-500 mr-1 hidden sm:inline">Marque</span>
      {brandColors.map((color, i) => (
        <button
          key={`${color}-${i}`}
          type="button"
          title="Appliquer la couleur"
          className={`h-5 w-5 rounded-full border-2 transition-transform hover:scale-110 ${lastUsedColor === color ? "border-blue-500" : "border-white dark:border-neutral-600"}`}
          style={{ backgroundColor: color }}
          onClick={() => setLastUsedColor(color)}
        />
      ))}
      {!readOnly && (
        <input
          type="color"
          className="h-5 w-5 rounded cursor-pointer border-0 p-0"
          value={brandColors[0] || "#2563EB"}
          onChange={(e) => {
            const next = [...brandColors];
            next[0] = e.target.value;
            setBrandColors(next);
            setLastUsedColor(e.target.value);
          }}
        />
      )}
      <div className="w-px h-4 bg-neutral-200 dark:bg-neutral-700 mx-1" />
      {NOTE_COLORS.slice(0, 3).map((color) => (
        <button
          key={color}
          type="button"
          className="h-4 w-4 rounded-full border border-neutral-200"
          style={{ backgroundColor: color }}
          onClick={() => setLastUsedColor(color)}
        />
      ))}
    </div>
  );
}
