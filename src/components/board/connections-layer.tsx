import { useCanvasStore } from "@/store/canvas-store";
import {
  buildConnectionPath,
  getConnectionEndpoints,
  getConnectionStyle,
  getStrokeDasharray,
  markerUrl,
} from "@/lib/connection-utils";

type ConnectionsLayerProps = {
  onConnectionPointerDown: (e: React.PointerEvent, connectionId: string) => void;
};

export function ConnectionsLayer({ onConnectionPointerDown }: ConnectionsLayerProps) {
  const connections = useCanvasStore((s) => s.connections);
  const layers = useCanvasStore((s) => s.layers);
  const selectedConnectionId = useCanvasStore((s) => s.selectedConnectionId);

  if (connections.length === 0) return null;

  return (
    <g className="pointer-events-none">
      {connections.map((connection) => {
        const from = layers[connection.fromId];
        const to = layers[connection.toId];
        if (!from || !to) return null;

        const { start, end } = getConnectionEndpoints(from, to);
        const style = getConnectionStyle(connection);
        const path = buildConnectionPath(start, end, style.routing);
        const dash = getStrokeDasharray(style.lineStyle);
        const selected = selectedConnectionId === connection.id;
        const stroke = selected ? "#2563EB" : style.stroke;

        return (
          <g key={connection.id} className="pointer-events-auto">
            <path
              d={path}
              fill="none"
              stroke="transparent"
              strokeWidth={14}
              className="cursor-pointer"
              onPointerDown={(e) => onConnectionPointerDown(e, connection.id)}
            />
            <path
              d={path}
              fill="none"
              stroke={stroke}
              strokeWidth={style.strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={dash}
              markerStart={markerUrl(style.arrowStart, "start")}
              markerEnd={markerUrl(style.arrowEnd, "end")}
              className={style.lineStyle === "solid" ? undefined : "connection-path-animated"}
              pointerEvents="none"
            />
          </g>
        );
      })}
    </g>
  );
}
