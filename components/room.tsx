"use client";

import { ReactNode } from "react";
import { RoomProvider } from "@/liveblocks.config";
import { ClientSideSuspense } from "@liveblocks/react";
import { Canvas } from "./board/canvas";
import { LiveMap, LiveList, LiveObject } from "@liveblocks/client";
import { Layer } from "@/liveblocks.config";
import { Loader2 } from "lucide-react";

interface RoomProps {
  children?: ReactNode;
  roomId: string;
  template: string;
  title: string;
}

export function Room({ children, roomId, template, title }: RoomProps) {
  return (
    <RoomProvider id={roomId} initialPresence={{ selection: [], cursor: null }} initialStorage={{
      layers: new LiveMap<string, LiveObject<Layer>>(),
      layerIds: new LiveList([]),
      auditLog: new LiveList([]),
    }}>
      <ClientSideSuspense fallback={<div>Loading…</div>}>
        <Canvas template={template} title={title} />
      </ClientSideSuspense>
    </RoomProvider>
  );
}

function Loading() {
    return (
        <div className="h-screen w-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-950 text-neutral-400">
            <Loader2 className="h-10 w-10 animate-spin" />
        </div>
    );
}
