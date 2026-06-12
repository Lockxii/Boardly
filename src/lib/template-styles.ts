/** Shared visual tokens for board templates (preview + canvas). */
export const BOARD_TEMPLATES = {
  blank: { label: "Vide" },
  grid: { label: "Grille" },
  blueprint: { label: "Plan" },
} as const;

export type BoardTemplateKey = keyof typeof BOARD_TEMPLATES;

export function getTemplateLabel(template: string) {
  return BOARD_TEMPLATES[template as BoardTemplateKey]?.label ?? template;
}

export const BLUEPRINT = {
  canvasClass: "bg-[#F0F5FA] dark:bg-[#1a2332]",
  previewClass: "bg-[#F0F5FA] dark:bg-[#1a2332]",
  line: "#C7DCF0",
  lineMajor: "#A8C8E8",
  lineDark: "rgba(148, 163, 184, 0.35)",
  lineMajorDark: "rgba(148, 163, 184, 0.55)",
} as const;
