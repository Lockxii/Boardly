import { cn } from "@/lib/utils";
import { BLUEPRINT } from "@/lib/template-styles";

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

      {template === "moodboard" && (
        <>
          <div className="absolute inset-0 bg-[#FAF8F5] dark:bg-neutral-900" />
          <div className="absolute top-3 left-3 right-3 bottom-3 rounded-lg border border-dashed border-amber-200/80" />
          <div className="absolute top-5 left-5 w-12 h-10 rounded bg-red-200/80" />
          <div className="absolute top-5 left-20 w-12 h-10 rounded bg-blue-200/80" />
          <div className="absolute top-5 left-[7.5rem] w-12 h-10 rounded bg-green-200/80" />
          <div className="absolute bottom-5 left-5 text-[8px] font-medium text-amber-700/70 uppercase tracking-wide">Moodboard</div>
        </>
      )}

      {template === "storyboard" && (
        <>
          <div className="absolute inset-0 bg-neutral-50 dark:bg-neutral-900" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="absolute top-4 rounded border border-neutral-300/70 bg-white dark:bg-neutral-800" style={{ left: `${12 + i * 28}%`, width: "24%", height: "55%" }} />
          ))}
          <div className="absolute bottom-4 left-3 text-[8px] text-neutral-500 uppercase tracking-wide">Storyboard</div>
        </>
      )}

      {template === "brief" && (
        <>
          <div className="absolute inset-0 bg-white dark:bg-neutral-900" />
          <div className="absolute top-3 left-3 right-3 bottom-3 rounded-lg border border-neutral-200 dark:border-neutral-700" />
          <div className="absolute top-5 left-5 w-[45%] h-8 rounded bg-amber-100 dark:bg-amber-900/30" />
          <div className="absolute top-14 left-5 w-[45%] h-12 rounded bg-blue-100 dark:bg-blue-900/30" />
          <div className="absolute bottom-5 left-5 text-[8px] text-neutral-500 uppercase">Brief</div>
        </>
      )}

      {template === "columns" && (
        <>
          <div className="absolute inset-0 bg-neutral-50 dark:bg-neutral-900" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="absolute top-3 bottom-3 rounded-lg border border-blue-200/70 bg-blue-50/50 dark:bg-blue-950/20" style={{ left: `${8 + i * 30}%`, width: "26%" }} />
          ))}
        </>
      )}

      {template === "kanban" && (
        <>
          <div className="absolute inset-0 bg-neutral-50 dark:bg-neutral-900" />
          {["#FCA5A5", "#FCD34D", "#86EFAC"].map((c, i) => (
            <div key={i} className="absolute top-3 bottom-3 rounded-lg border border-neutral-300/70 bg-white dark:bg-neutral-800" style={{ left: `${8 + i * 30}%`, width: "26%" }}>
              <div className="mt-1.5 mx-auto h-1 w-[70%] rounded" style={{ background: c }} />
              <div className="mt-2 mx-auto h-3 w-[80%] rounded bg-neutral-100 dark:bg-neutral-700" />
              <div className="mt-1 mx-auto h-3 w-[80%] rounded bg-neutral-100 dark:bg-neutral-700" />
            </div>
          ))}
        </>
      )}

      {template === "retro" && (
        <>
          <div className="absolute inset-0 bg-neutral-50 dark:bg-neutral-900" />
          {["#86EFAC", "#FCA5A5", "#FCD34D"].map((c, i) => (
            <div key={i} className="absolute top-5 bottom-3 rounded-lg border border-neutral-300/70" style={{ left: `${8 + i * 30}%`, width: "26%", background: `${c}33` }} />
          ))}
          <div className="absolute top-1.5 left-3 h-1.5 w-10 rounded bg-neutral-400/70" />
        </>
      )}

      {template === "mindmap" && (
        <>
          <div className="absolute inset-0 bg-white dark:bg-neutral-900" />
          <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 60">
            <line x1="50" y1="30" x2="20" y2="14" stroke="#93C5FD" strokeWidth="1" />
            <line x1="50" y1="30" x2="80" y2="14" stroke="#93C5FD" strokeWidth="1" />
            <line x1="50" y1="30" x2="20" y2="46" stroke="#93C5FD" strokeWidth="1" />
            <line x1="50" y1="30" x2="80" y2="46" stroke="#93C5FD" strokeWidth="1" />
          </svg>
          <div className="absolute left-1/2 top-1/2 h-4 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-200 dark:bg-blue-900/50" />
          {[[14, 10], [72, 10], [14, 66], [72, 66]].map(([l, t], i) => (
            <div key={i} className="absolute h-3 w-8 rounded bg-neutral-100 dark:bg-neutral-700" style={{ left: `${l}%`, top: `${t}%` }} />
          ))}
        </>
      )}

      {template === "flowchart" && (
        <>
          <div className="absolute inset-0 bg-white dark:bg-neutral-900" />
          <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 60">
            <line x1="50" y1="16" x2="50" y2="46" stroke="#94A3B8" strokeWidth="1" />
          </svg>
          <div className="absolute left-1/2 top-[12%] h-3.5 w-12 -translate-x-1/2 rounded-full bg-green-200 dark:bg-green-900/40" />
          <div className="absolute left-1/2 top-[42%] h-4 w-12 -translate-x-1/2 rounded bg-blue-200 dark:bg-blue-900/40" />
          <div className="absolute left-1/2 top-[74%] h-3.5 w-12 -translate-x-1/2 rounded-full bg-red-200 dark:bg-red-900/40" />
        </>
      )}
    </div>
  );
}
