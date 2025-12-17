import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function pointerEventToCanvasPoint(
  e: React.PointerEvent,
  camera: { x: number; y: number; zoom: number }
) {
  return {
    x: Math.round((e.clientX - camera.x) / camera.zoom),
    y: Math.round((e.clientY - camera.y) / camera.zoom),
  };
}

export function colorToCss(color: string) {
  return color;
}
