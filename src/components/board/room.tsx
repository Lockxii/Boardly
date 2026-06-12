import { Canvas } from "./canvas";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useCanvasStore } from "@/store/canvas-store";

interface RoomProps {
  roomId: string;
  template: string;
  title: string;
  boardId?: string;
}

export function Room({ roomId, template, title, boardId }: RoomProps) {
  const [ready, setReady] = useState(false);
  const loadBoard = useCanvasStore((s) => s.loadBoard);

  useEffect(() => {
    loadBoard(roomId);
    setReady(true);
  }, [roomId, loadBoard]);

  // Auto-save every 5 seconds
  useEffect(() => {
    if (!ready) return;
    const interval = setInterval(() => {
      useCanvasStore.getState().saveBoard(roomId);
    }, 5000);
    return () => clearInterval(interval);
  }, [ready, roomId]);

  if (!ready) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-950 text-neutral-400">
        <Loader2 className="h-10 w-10 animate-spin" />
      </div>
    );
  }

  return <Canvas template={template} title={title} boardId={boardId} />;
}
