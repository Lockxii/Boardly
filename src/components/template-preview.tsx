import { cn } from "@/lib/utils";

const TEMPLATE_LABELS: Record<string, string> = {
  blank: "Vide",
  grid: "Grille",
  blueprint: "Plan",
};

export function TemplatePreview({ template, className }: { template: string; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-xl border border-neutral-200/80 dark:border-neutral-700/80 bg-white dark:bg-neutral-900", className)}>
      {template === "grid" && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(#d4d4d4 1px, transparent 1px)",
            backgroundSize: "12px 12px",
          }}
        />
      )}
      {template === "blueprint" && (
        <>
          <div className="absolute inset-0 bg-[#1e40af]" />
          <div
            className="absolute inset-0 opacity-60"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />
        </>
      )}
      {template === "blank" && <div className="absolute inset-0 bg-white dark:bg-neutral-900" />}
    </div>
  );
}

export function getTemplateLabel(template: string) {
  return TEMPLATE_LABELS[template] || template;
}
