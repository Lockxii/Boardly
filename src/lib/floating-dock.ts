export type DockAnchor =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right"
  | "left-center"
  | "right-center";

export type DockState = {
  anchor: DockAnchor;
  /** Free position once the user has dragged the dock (overrides the anchor). */
  pos?: { x: number; y: number } | null;
  /** Minimal pill (zoom bar) */
  collapsed: boolean;
  /** Tight layout — logo + tools grouped (navbar) */
  compact: boolean;
};

/** Keep a dock fully on-screen so its grip is always grabbable. */
export function clampDockPos(pos: { x: number; y: number }, size?: { w: number; h: number }) {
  if (typeof window === "undefined") return pos;
  const w = size?.w ?? 0;
  const h = size?.h ?? 0;
  const margin = 8;
  return {
    x: Math.min(Math.max(margin, pos.x), Math.max(margin, window.innerWidth - w - margin)),
    y: Math.min(Math.max(margin, pos.y), Math.max(margin, window.innerHeight - h - margin)),
  };
}

export function isVerticalDock(anchor: DockAnchor) {
  return anchor === "left-center" || anchor === "right-center";
}

/** Clearance above the board status bar (h-7) + breathing room */
export const DOCK_BOTTOM_OFFSET = "2.75rem";

export function dockAnchorClasses(anchor: DockAnchor) {
  switch (anchor) {
    case "top-left":
      return "top-4 left-4";
    case "top-center":
      return "top-4 left-1/2 -translate-x-1/2 max-w-[calc(100vw-2rem)]";
    case "top-right":
      return "top-4 right-4";
    case "bottom-left":
      return `left-4 max-w-[calc(100vw-2rem)]`;
    case "bottom-center":
      return `left-1/2 -translate-x-1/2 max-w-[calc(100vw-2rem)]`;
    case "bottom-right":
      return `right-4 max-w-[calc(100vw-2rem)]`;
    case "left-center":
      return "left-4 top-1/2 -translate-y-1/2";
    case "right-center":
      return "right-4 top-1/2 -translate-y-1/2";
  }
}

export function dockAnchorStyle(anchor: DockAnchor): { bottom: string } | undefined {
  if (!anchor.startsWith("bottom")) return undefined;
  return { bottom: DOCK_BOTTOM_OFFSET };
}

export function centerAnchor(anchor: DockAnchor): DockAnchor {
  if (anchor.startsWith("bottom")) return "bottom-center";
  if (anchor === "left-center" || anchor === "right-center") return "top-center";
  return "top-center";
}

export function snapPointerToAnchor(x: number, y: number, width: number, height: number): DockAnchor {
  const xRatio = x / width;
  const yRatio = y / height;

  const col = xRatio < 0.28 ? "left" : xRatio > 0.72 ? "right" : "center";
  const row = yRatio < 0.28 ? "top" : yRatio > 0.72 ? "bottom" : "middle";

  if (row === "top") {
    if (col === "left") return "top-left";
    if (col === "right") return "top-right";
    return "top-center";
  }
  if (row === "bottom") {
    if (col === "left") return "bottom-left";
    if (col === "right") return "bottom-right";
    return "bottom-center";
  }
  if (col === "left") return "left-center";
  if (col === "right") return "right-center";
  return yRatio < 0.5 ? "top-center" : "bottom-center";
}

export function loadDockState(
  id: string,
  defaultAnchor: DockAnchor,
  defaults?: { compact?: boolean },
): DockState {
  try {
    const raw = localStorage.getItem(`boardly-dock-${id}`);
    if (!raw) {
      return {
        anchor: defaultAnchor,
        collapsed: false,
        compact: defaults?.compact ?? false,
      };
    }
    const parsed = JSON.parse(raw) as Partial<DockState & { collapsed?: boolean }>;
    const pos =
      parsed.pos && typeof parsed.pos.x === "number" && typeof parsed.pos.y === "number"
        ? clampDockPos(parsed.pos)
        : null;
    return {
      anchor: parsed.anchor || defaultAnchor,
      pos,
      collapsed: !!parsed.collapsed && !parsed.compact,
      compact: parsed.compact ?? defaults?.compact ?? !!parsed.collapsed,
    };
  } catch {
    return {
      anchor: defaultAnchor,
      collapsed: false,
      compact: defaults?.compact ?? false,
    };
  }
}

export function saveDockState(id: string, state: DockState) {
  localStorage.setItem(`boardly-dock-${id}`, JSON.stringify(state));
}
