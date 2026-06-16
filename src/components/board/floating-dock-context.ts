import { createContext, useContext } from "react";
import type { DockAnchor } from "@/lib/floating-dock";

type FloatingDockContextValue = {
  vertical: boolean;
  compact: boolean;
  anchor: DockAnchor;
};

export const FloatingDockContext = createContext<FloatingDockContextValue>({
  vertical: false,
  compact: true,
  anchor: "top-center",
});

export function useFloatingDock() {
  return useContext(FloatingDockContext);
}
