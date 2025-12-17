"use client";

import { RoomProvider } from "@/liveblocks.config";
import { ClientSideSuspense } from "@liveblocks/react";
import { LiveMap, LiveList } from "@liveblocks/client";
import { Canvas } from "./board/canvas";
import { Loader2 } from "lucide-react";

export function Room({ roomId, template }: { roomId: string, template: string }) {
    return (
        <RoomProvider 
            id={roomId} 
            initialPresence={{ cursor: null, selection: [] }}
            initialStorage={{ layers: new LiveMap(), layerIds: new LiveList([]) }}
        >
            <ClientSideSuspense fallback={<Loading />}>
                {() => <Canvas template={template} />}
            </ClientSideSuspense>
        </RoomProvider>
    )
}

function Loading() {
    return (
        <div className="h-screen w-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-950 text-neutral-400">
            <Loader2 className="h-10 w-10 animate-spin" />
        </div>
    );
}
