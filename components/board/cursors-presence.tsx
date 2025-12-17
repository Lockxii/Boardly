"use client";

import { useOthers } from "@/liveblocks.config";
import { MousePointer2 } from "lucide-react";
import { memo } from "react";

const COLORS = ["#DC2626", "#D97706", "#059669", "#7C3AED", "#DB2777"];

function Cursor({ x, y, name, color }: { x: number, y: number, name: string, color: string }) {
    return (
        <g style={{ transform: `translate(${x}px, ${y}px)` }}>
            <path 
                d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19841L11.7841 12.3673H5.65376Z" 
                fill={color}
            />
            <foreignObject x={10} y={10} width={100} height={30} className="overflow-visible">
                 <div 
                    className="px-1.5 py-0.5 rounded text-xs text-white font-semibold whitespace-nowrap inline-block shadow-sm"
                    style={{ backgroundColor: color }}
                >
                    {name}
                </div>
            </foreignObject>
        </g>
    )
}

export const CursorsPresence = memo(() => {
    const others = useOthers();

    return (
        <>
            {others.map(({ connectionId, presence, info }) => {
                if (!presence?.cursor) return null;
                return (
                    <Cursor
                        key={connectionId}
                        x={presence.cursor.x}
                        y={presence.cursor.y}
                        name={info?.name || "Teammate"}
                        color={COLORS[connectionId % COLORS.length]}
                    />
                )
            })}
        </>
    )
});

CursorsPresence.displayName = "CursorsPresence";
