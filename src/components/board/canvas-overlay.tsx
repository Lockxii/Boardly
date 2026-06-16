import { memo } from "react";
import { useCanvasStore } from "@/store/canvas-store";
import { buildConnectionPath, getConnectionEndpoints, getStrokeDasharray, getLayerEdgePoint, markerUrl } from "@/lib/connection-utils";
import type { Layer } from "@/lib/types";

type CanvasOverlayProps = {
  translateGhost: Record<string, Layer> | null;
  cursorPoint: { x: number; y: number } | null;
};

export const CanvasOverlay = memo(function CanvasOverlay({ translateGhost, cursorPoint }: CanvasOverlayProps) {
  const canvasState = useCanvasStore((s) => s.canvasState);
  const connectFromId = useCanvasStore((s) => s.connectFromId);
  const connectHoverId = useCanvasStore((s) => s.connectHoverId);
  const connectionDefaults = useCanvasStore((s) => s.connectionDefaults);
  const layers = useCanvasStore((s) => s.layers);
  const snapToGrid = useCanvasStore((s) => s.snapToGrid);

  return (
    <g className="pointer-events-none">
      {translateGhost &&
        Object.entries(translateGhost).map(([id, layer]) => (
          <rect
            key={`ghost-${id}`}
            x={layer.x}
            y={layer.y}
            width={layer.width}
            height={layer.height}
            rx={layer.cornerRadius || 8}
            className="layer-translate-ghost"
          />
        ))}

      {snapToGrid && canvasState.mode === "translating" && cursorPoint && (
        <>
          <line
            x1={Math.round(cursorPoint.x / 20) * 20}
            y1={-100000}
            x2={Math.round(cursorPoint.x / 20) * 20}
            y2={100000}
            className="snap-guide-line"
          />
          <line
            x1={-100000}
            y1={Math.round(cursorPoint.y / 20) * 20}
            x2={100000}
            y2={Math.round(cursorPoint.y / 20) * 20}
            className="snap-guide-line"
          />
        </>
      )}

      {connectFromId && cursorPoint && layers[connectFromId] && (() => {
        const from = layers[connectFromId];
        const hover = connectHoverId ? layers[connectHoverId] : null;
        const start = hover && connectHoverId !== connectFromId
          ? getConnectionEndpoints(from, hover).start
          : getLayerEdgePoint(from, cursorPoint);
        const endPoint = hover && connectHoverId !== connectFromId
          ? getConnectionEndpoints(from, hover).end
          : cursorPoint;
        const path = buildConnectionPath(start, endPoint, connectionDefaults.routing);
        const dash = getStrokeDasharray(connectionDefaults.lineStyle);
        return (
          <g>
            <path
              d={path}
              fill="none"
              stroke="#2563EB"
              strokeWidth={connectionDefaults.strokeWidth}
              strokeDasharray={dash}
              strokeLinecap="round"
              markerStart={markerUrl(connectionDefaults.arrowStart, "start")}
              markerEnd={markerUrl(connectionDefaults.arrowEnd, "end")}
            />
            {!hover && <circle cx={cursorPoint.x} cy={cursorPoint.y} r={5} fill="#2563EB" opacity={0.6} />}
          </g>
        );
      })()}

      {connectHoverId && connectFromId && layers[connectHoverId] && connectHoverId !== connectFromId && (
        <rect
          x={layers[connectHoverId].x - 3}
          y={layers[connectHoverId].y - 3}
          width={layers[connectHoverId].width + 6}
          height={layers[connectHoverId].height + 6}
          rx={8}
          className="connect-hover-ring"
        />
      )}

      {canvasState.mode === "inserting" && canvasState.origin && canvasState.current && (() => {
        const x = Math.min(canvasState.origin.x, canvasState.current.x);
        const y = Math.min(canvasState.origin.y, canvasState.current.y);
        const w = Math.abs(canvasState.origin.x - canvasState.current.x);
        const h = Math.abs(canvasState.origin.y - canvasState.current.y);
        const label = `${Math.round(w)} × ${Math.round(h)}`;

        if (canvasState.layerType === "Line") {
          return (
            <>
              <line
                className="stroke-blue-500 stroke-1 insertion-preview"
                x1={canvasState.origin.x}
                y1={canvasState.origin.y}
                x2={canvasState.current.x}
                y2={canvasState.current.y}
                strokeWidth={3}
                strokeLinecap="round"
              />
              <text
                x={(canvasState.origin.x + canvasState.current.x) / 2}
                y={(canvasState.origin.y + canvasState.current.y) / 2 - 8}
                textAnchor="middle"
                className="insertion-dim-label"
              >
                {Math.round(Math.hypot(w, h))}px
              </text>
            </>
          );
        }

        const shape =
          canvasState.layerType === "Frame" || canvasState.layerType === "Column" ? (
            <rect className="insertion-preview fill-blue-500/8 stroke-blue-500 stroke-1" strokeDasharray={canvasState.layerType === "Frame" ? "8 4" : undefined} x={x} y={y} width={w} height={h} rx={12} />
          ) : canvasState.layerType === "Ellipse" ? (
            <ellipse className="insertion-preview fill-blue-500/8 stroke-blue-500 stroke-1" cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} />
          ) : canvasState.layerType === "Triangle" ? (
            <polygon className="insertion-preview fill-blue-500/8 stroke-blue-500 stroke-1" points={`${x + w / 2},${y} ${x + w},${y + h} ${x},${y + h}`} />
          ) : canvasState.layerType === "Diamond" ? (
            <polygon className="insertion-preview fill-blue-500/8 stroke-blue-500 stroke-1" points={`${x + w / 2},${y} ${x + w},${y + h / 2} ${x + w / 2},${y + h} ${x},${y + h / 2}`} />
          ) : canvasState.layerType === "Arrow" ? (
            <path className="insertion-preview fill-blue-500/8 stroke-blue-500 stroke-1" d={`M ${x},${y + h * 0.3} L ${x + w * 0.6},${y + h * 0.3} L ${x + w * 0.6},${y} L ${x + w},${y + h * 0.5} L ${x + w * 0.6},${y + h} L ${x + w * 0.6},${y + h * 0.7} L ${x},${y + h * 0.7} Z`} />
          ) : (
            <rect className="insertion-preview fill-blue-500/8 stroke-blue-500 stroke-1" x={x} y={y} width={w} height={h} rx={6} />
          );

        return (
          <>
            {shape}
            {w > 20 && h > 20 && (
              <text x={x + w / 2} y={y + h / 2} textAnchor="middle" dominantBaseline="middle" className="insertion-dim-label">
                {label}
              </text>
            )}
          </>
        );
      })()}

      {canvasState.mode === "selectionNet" && canvasState.current && (
        <rect
          className="fill-blue-500/5 stroke-blue-500 stroke-1"
          x={Math.min(canvasState.origin.x, canvasState.current.x)}
          y={Math.min(canvasState.origin.y, canvasState.current.y)}
          width={Math.abs(canvasState.origin.x - canvasState.current.x)}
          height={Math.abs(canvasState.origin.y - canvasState.current.y)}
        />
      )}
    </g>
  );
});
