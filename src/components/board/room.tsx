import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Canvas } from "./canvas";
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
  const queryClient = useQueryClient();
  const loadBoard = useCanvasStore((s) => s.loadBoard);
  const saveBoard = useCanvasStore((s) => s.saveBoard);
  const resetBoard = useCanvasStore((s) => s.resetBoard);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setReady(false);
      resetBoard();
      await loadBoard(roomId);
      if (cancelled) return;
      const isDark = document.documentElement.classList.contains("dark");
      useCanvasStore.setState({ darkMode: isDark });
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [roomId, loadBoard, resetBoard]);

  useEffect(() => {
    if (!ready) return;
    const interval = setInterval(() => {
      void saveBoard(roomId);
    }, 5000);
    return () => clearInterval(interval);
  }, [ready, roomId, saveBoard]);

  useEffect(() => {
    if (!ready) return;
    return () => {
      void saveBoard(roomId).then(() => {
        queryClient.invalidateQueries({ queryKey: ["boards"] });
      });
    };
  }, [ready, roomId, saveBoard, queryClient]);

  if (!ready) {
    return <RouteLoading label="Chargement du canvas..." />;
  }

  return <Canvas template={template} title={title} boardId={boardId} />;
}
