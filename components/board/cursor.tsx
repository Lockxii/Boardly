"use client";

import { memo } from "react";
import { MousePointer2 } from "lucide-react";
import { useOther } from "@/liveblocks.config";

interface CursorProps {
    connectionId: number;
}

const COLORS = [
    "#DC2626", 
    "#D97706", 
    "#059669", 
    "#7C3AED", 
    "#DB2777",
    "#2563EB",
    "#4F46E5",
    "#9333EA"
];

export const Cursor = memo(({ connectionId }: CursorProps) => {
    const info = useOther(connectionId, (user) => user?.info);
    const cursor = useOther(connectionId, (user) => user?.presence?.cursor);

    if (!cursor) return null;

    const { x, y } = cursor;
    const name = info?.name || "Anonyme";
    const color = COLORS[connectionId % COLORS.length];

    return (
        <foreignObject
            style={{
                transform: `translateX(${x}px) translateY(${y}px)`,
                transition: "transform 120ms linear", // Smooth interpolation
            }}
            height={50}
            width={name.length * 10 + 24}
            className="relative drop-shadow-md pointer-events-none"
        >
            <div className="relative">
                <MousePointer2
                    className="h-5 w-5"
                    style={{
                        fill: color,
                        color: color,
                    }}
                />
                <div
                    className="absolute left-5 top-2.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold text-white whitespace-nowrap"
                    style={{ backgroundColor: color }}
                >
                    {name}
                </div>
            </div>
        </foreignObject>
    );
});

Cursor.displayName = "Cursor";
