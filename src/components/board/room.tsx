import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Canvas } from "./canvas";
import { useCanvasStore } from "@/store/canvas-store";
import { RouteLoading } from "@/components/route-loading";
import { apiFetch } from "@/lib/utils";
import { applyRemoteBoardUpdate } from "@/lib/board-remote-sync";
import { fitCameraToBoard } from "@/lib/canvas-utils";

interface RoomProps {
  roomId: string;
  template: string;
  title: string;
  boardId?: string;
  isPublic?: boolean;
  isOwner?: boolean;
}

export function Room({ roomId, template, title, boardId, isPublic, isOwner = false }: RoomProps) {
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
      const state = useCanvasStore.getState();
      const camera = fitCameraToBoard(state.layers, state.layerIds);
      if (camera) useCanvasStore.setState({ camera });
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

  useEffect(() => {
    if (!ready) return;

    let cancelled = false;
    let remoteUpdatedAt = 0;

    const pullRemote = async (options: { userId?: string; userName?: string; notify?: boolean } = {}) => {
      try {
        const remote = await apiFetch<{ canvasData: import("@/lib/types").BoardCanvasData | null; updatedAt: string; rev?: number }>(
          `/api/boards/${roomId}/content`
        );
        const updatedAt = new Date(remote.updatedAt).getTime();
        if (updatedAt <= remoteUpdatedAt) return;
        remoteUpdatedAt = updatedAt;
        await applyRemoteBoardUpdate(remote, options);
      } catch {
        /* offline or auth */
      }
    };

    const pollInterval = setInterval(() => {
      void pullRemote();
    }, 8000);

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
    };
  }, [ready, roomId]);

  if (!ready) {
    return <RouteLoading label="Chargement du canvas..." />;
  }

  return (
    <Canvas
      template={template}
      title={title}
      boardId={boardId}
      roomId={roomId}
      isPublic={isPublic}
      isOwner={isOwner}
    />
  );
}
