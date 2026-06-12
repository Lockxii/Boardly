import type { BoardConnection, Layer } from "@/lib/types";

export type ConnectionLineStyle = "solid" | "dashed" | "dotted";
export type ConnectionMarker = "none" | "arrow" | "dot";
export type ConnectionRouting = "bezier" | "straight";

export type ConnectionStyle = {
  stroke: string;
  strokeWidth: number;
  lineStyle: ConnectionLineStyle;
  arrowStart: ConnectionMarker;
  arrowEnd: ConnectionMarker;
  routing: ConnectionRouting;
};

export const DEFAULT_CONNECTION_STYLE: ConnectionStyle = {
  stroke: "#64748B",
  strokeWidth: 2,
  lineStyle: "solid",
  arrowStart: "none",
  arrowEnd: "arrow",
  routing: "bezier",
};

export function getLayerEdgePoint(layer: Layer, target: { x: number; y: number }) {
  const cx = layer.x + layer.width / 2;
  const cy = layer.y + layer.height / 2;
  const dx = target.x - cx;
  const dy = target.y - cy;

  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
    return { x: cx, y: cy };
  }

  const scale = Math.min(
    Math.abs(layer.width / 2 / dx),
    Math.abs(layer.height / 2 / dy),
  );

  return { x: cx + dx * scale, y: cy + dy * scale };
}

export function getConnectionEndpoints(from: Layer, to: Layer) {
  const toCenter = { x: to.x + to.width / 2, y: to.y + to.height / 2 };
  const fromCenter = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
  return {
    start: getLayerEdgePoint(from, toCenter),
    end: getLayerEdgePoint(to, fromCenter),
  };
}

export function buildConnectionPath(
  start: { x: number; y: number },
  end: { x: number; y: number },
  routing: ConnectionRouting = "bezier",
) {
  if (routing === "straight") {
    return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
  }
  const midX = (start.x + end.x) / 2;
  return `M ${start.x} ${start.y} C ${midX} ${start.y}, ${midX} ${end.y}, ${end.x} ${end.y}`;
}

export function getStrokeDasharray(lineStyle: ConnectionLineStyle = "solid") {
  if (lineStyle === "dashed") return "10 6";
  if (lineStyle === "dotted") return "2 6";
  return undefined;
}

export function getConnectionStyle(connection: BoardConnection): ConnectionStyle {
  return {
    stroke: connection.stroke || DEFAULT_CONNECTION_STYLE.stroke,
    strokeWidth: connection.strokeWidth || DEFAULT_CONNECTION_STYLE.strokeWidth,
    lineStyle: connection.lineStyle || DEFAULT_CONNECTION_STYLE.lineStyle,
    arrowStart: connection.arrowStart ?? DEFAULT_CONNECTION_STYLE.arrowStart,
    arrowEnd: connection.arrowEnd ?? DEFAULT_CONNECTION_STYLE.arrowEnd,
    routing: connection.routing || DEFAULT_CONNECTION_STYLE.routing,
  };
}

export function markerUrl(marker: ConnectionMarker, side: "start" | "end") {
  if (marker === "none") return undefined;
  if (marker === "dot") return side === "start" ? "url(#conn-dot-start)" : "url(#conn-dot-end)";
  return side === "start" ? "url(#conn-arrow-start)" : "url(#conn-arrow-end)";
}
