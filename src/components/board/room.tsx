import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Canvas } from "./canvas";
import { useCanvasStore } from "@/store/canvas-store";
import { RouteLoading } from "@/components/route-loading";
import { apiFetch } from "@/lib/utils";
import type { BoardCanvasData } from "@/lib/types";

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

  useEffect(() => {
    if (!ready) return;
    let remoteUpdatedAt = 0;

    const pollRemote = async () => {
      try {
        const remote = await apiFetch<{ canvasData: BoardCanvasData | null; updatedAt: string }>(
          `/api/boards/${roomId}/content`
        );
        const updatedAt = new Date(remote.updatedAt).getTime();
        if (updatedAt <= remoteUpdatedAt) return;
        remoteUpdatedAt = updatedAt;

        const state = useCanvasStore.getState();
        if (state.saveStatus === "saving") return;
        if (!remote.canvasData?.layerIds?.length) return;
        if (state.lastSavedAt && updatedAt <= state.lastSavedAt + 2000) return;

        useCanvasStore.setState({
          layers: remote.canvasData.layers,
          layerIds: remote.canvasData.layerIds,
          connections: remote.canvasData.connections || [],
          versions: remote.canvasData.versions || [],
          selection: [],
        });
      } catch {}
    };

    const interval = setInterval(pollRemote, 12000);
    return () => clearInterval(interval);
  }, [ready, roomId]);

  if (!ready) {
    return <RouteLoading label="Chargement du canvas..." />;
  }

  return <Canvas template={template} title={title} boardId={boardId} />;
}
