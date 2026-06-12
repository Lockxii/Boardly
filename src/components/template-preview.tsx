import { cn } from "@/lib/utils";
import { BLUEPRINT, getTemplateLabel, BOARD_TEMPLATES } from "@/lib/template-styles";

export { getTemplateLabel, BOARD_TEMPLATES };

export function TemplatePreview({ template, className }: { template: string; className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-neutral-200/80 dark:border-neutral-700/80",
        className
      )}
    >
      {template === "blank" && (
        <div className="absolute inset-0 bg-white dark:bg-neutral-900" />
      )}

      {template === "grid" && (
        <>
          <div className="absolute inset-0 bg-white dark:bg-neutral-900" />
          <div
            className="absolute inset-0 dark:opacity-60"
            style={{
              backgroundImage: "radial-gradient(#d4d4d4 1px, transparent 1px)",
              backgroundSize: "10px 10px",
            }}
          />
        </>
      )}

      {template === "blueprint" && (
        <>
          <div className={cn("absolute inset-0", BLUEPRINT.previewClass)} />
          {/* fine grid */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `linear-gradient(${BLUEPRINT.line} 1px, transparent 1px), linear-gradient(90deg, ${BLUEPRINT.line} 1px, transparent 1px)`,
              backgroundSize: "12px 12px",
            }}
          />
          {/* major grid */}
          <div
            className="absolute inset-0 opacity-80"
            style={{
              backgroundImage: `linear-gradient(${BLUEPRINT.lineMajor} 1px, transparent 1px), linear-gradient(90deg, ${BLUEPRINT.lineMajor} 1px, transparent 1px)`,
              backgroundSize: "36px 36px",
            }}
          />
          {/* subtle blueprint accent */}
          <div className="absolute bottom-3 left-3 right-3 h-px bg-blue-300/50" />
          <div className="absolute top-3 bottom-3 left-3 w-px bg-blue-300/50" />
          <div className="absolute top-4 left-5 text-[8px] font-medium tracking-widest text-blue-400/80 uppercase">
            Plan
          </div>
        </>
      )}
    </div>
  );
}
