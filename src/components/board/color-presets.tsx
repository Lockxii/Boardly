import { useCanvasStore } from "@/store/use-canvas-store";
import { Button } from "@/components/ui/button";
import { Palette, Pipette } from "lucide-react";
import { useState } from "react";

const PRESET_COLORS = [
  "#000000", "#FFFFFF", "#EF4444", "#F97316", "#EAB308",
  "#22C55E", "#3B82F6", "#8B5CF6", "#EC4899", "#6B7280",
  "#1E3A5F", "#D97706", "#059669", "#7C3AED", "#DB2777",
  "#FBBF24", "#10B981", "#6366F1", "#F43F5E", "#14B8A6",
];

export function ColorPresets({ onSelect }: { onSelect: (color: string) => void }) {
  const { lastUsedColor, setLastUsedColor } = useCanvasStore();

  return (
    <div className="flex flex-wrap gap-1.5 max-w-[180px]">
      {PRESET_COLORS.map((color) => (
        <button
          key={color}
          className={`w-6 h-6 rounded-full border-2 transition-all hover:scale-110 ${
            lastUsedColor === color
              ? "border-blue-500 ring-2 ring-blue-500/30 scale-110"
              : "border-neutral-200 dark:border-neutral-600"
          }`}
          style={{ backgroundColor: color }}
          onClick={() => {
            setLastUsedColor(color);
            onSelect(color);
          }}
          title={color}
        />
      ))}
      <div className="relative w-6 h-6 rounded-full border-2 border-dashed border-neutral-300 dark:border-neutral-600 overflow-hidden hover:border-blue-400 transition">
        <input
          type="color"
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          value={lastUsedColor}
          onChange={(e) => {
            setLastUsedColor(e.target.value);
            onSelect(e.target.value);
          }}
        />
        <Pipette className="h-3 w-3 m-auto mt-1.5 text-neutral-400 pointer-events-none" />
      </div>
    </div>
  );
}
