import { useCanvasStore } from "@/store/canvas-store";
import { getLayerCenter } from "@/lib/canvas-utils";
import { bezierConnectionPath } from "@/lib/motion-utils";

export function ConnectionsLayer() {
  const connections = useCanvasStore((s) => s.connections);
  const layers = useCanvasStore((s) => s.layers);

  if (connections.length === 0) return null;

  return (
    <g className="pointer-events-none">
      {connections.map((connection) => {
        const from = layers[connection.fromId];
        const to = layers[connection.toId];
        if (!from || !to) return null;
        const a = getLayerCenter(from);
        const b = getLayerCenter(to);
        const path = bezierConnectionPath(a, b);
        return (
          <g key={connection.id}>
            <path
              d={path}
              fill="none"
              stroke={connection.stroke || "#64748B"}
              strokeWidth={connection.strokeWidth || 2}
              strokeLinecap="round"
              className="connection-path"
            />
            <circle cx={b.x} cy={b.y} r={4} fill={connection.stroke || "#64748B"} />
          </g>
        );
      })}
    </g>
  );
}
