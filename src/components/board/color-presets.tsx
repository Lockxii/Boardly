import { useCanvasStore } from "@/store/use-canvas-store";
import { Pipette, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PRESET_COLORS = [
  "#000000", "#FFFFFF", "#EF4444", "#F97316", "#EAB308",
  "#22C55E", "#3B82F6", "#8B5CF6", "#EC4899", "#6B7280",
  "#1E3A5F", "#D97706", "#059669", "#7C3AED", "#DB2777",
  "#FBBF24", "#10B981", "#6366F1", "#F43F5E", "#14B8A6",
];

const COMPACT_COLORS = PRESET_COLORS.slice(0, 8);

function Swatch({
  color,
  selected,
  size = "md",
  onClick,
}: {
  color: string;
  selected: boolean;
  size?: "sm" | "md";
  onClick: () => void;
}) {
  const dim = size === "sm" ? "h-5 w-5" : "h-6 w-6";
  return (
    <button
      type="button"
      className={`${dim} shrink-0 rounded-full border-2 transition-all hover:scale-110 ${
        selected
          ? "border-blue-500 ring-2 ring-blue-500/30 scale-110"
          : "border-neutral-200 dark:border-neutral-600"
      }`}
      style={{ backgroundColor: color }}
      onClick={onClick}
      title={color}
    />
  );
}

export function ColorPresets({
  onSelect,
  compact = false,
}: {
  onSelect: (color: string) => void;
  compact?: boolean;
}) {
  const { lastUsedColor, setLastUsedColor } = useCanvasStore();

  const pick = (color: string) => {
    setLastUsedColor(color);
    onSelect(color);
  };

  if (compact) {
    return (
      <div className="flex flex-nowrap items-center gap-1">
        {COMPACT_COLORS.map((color) => (
          <Swatch key={color} color={color} selected={lastUsedColor === color} size="sm" onClick={() => pick(color)} />
        ))}
        <div className="relative h-5 w-5 shrink-0 overflow-hidden rounded-full border-2 border-dashed border-neutral-300 dark:border-neutral-600">
          <input
            type="color"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            value={lastUsedColor}
            onChange={(e) => pick(e.target.value)}
          />
          <Pipette className="pointer-events-none m-auto mt-0.5 h-3 w-3 text-neutral-400" />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-neutral-50 text-neutral-500 hover:bg-neutral-100 dark:border-neutral-600 dark:bg-neutral-900"
              title="Plus de couleurs"
            >
              <Plus className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-auto p-2">
            <div className="flex max-w-[180px] flex-wrap gap-1.5">
              {PRESET_COLORS.map((color) => (
                <Swatch key={color} color={color} selected={lastUsedColor === color} onClick={() => pick(color)} />
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5 max-w-[180px]">
      {PRESET_COLORS.map((color) => (
        <Swatch key={color} color={color} selected={lastUsedColor === color} onClick={() => pick(color)} />
      ))}
      <div className="relative h-6 w-6 overflow-hidden rounded-full border-2 border-dashed border-neutral-300 dark:border-neutral-600 hover:border-blue-400 transition">
        <input
          type="color"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          value={lastUsedColor}
          onChange={(e) => pick(e.target.value)}
        />
        <Pipette className="pointer-events-none m-auto mt-1.5 h-3 w-3 text-neutral-400" />
      </div>
    </div>
  );
}
