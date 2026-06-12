import { Canvas } from "./canvas";
import { useEffect, useState } from "react";
import { useCanvasStore } from "@/store/canvas-store";
import { RouteLoading } from "@/components/route-loading";

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
    const isDark = document.documentElement.classList.contains("dark");
    useCanvasStore.setState({ darkMode: isDark });
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
    return <RouteLoading label="Chargement du canvas..." />;
  }

  return <Canvas template={template} title={title} boardId={boardId} />;
}
