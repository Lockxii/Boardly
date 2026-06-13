import { useEffect, useLayoutEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Canvas } from "./canvas";
import { useCanvasStore } from "@/store/canvas-store";
import { RouteLoading } from "@/components/route-loading";
import { apiFetch } from "@/lib/utils";
import { applyRemoteBoardUpdate } from "@/lib/board-remote-sync";
import {
  acquireBoardSocket,
  joinBoardRoom,
  releaseBoardSocket,
  getBoardSocket,
  type BoardUpdatedEvent,
} from "@/lib/board-socket";
import { fitCameraToBoard } from "@/lib/canvas-utils";
import { fetchCurrentUser } from "@/lib/auth-client";

interface RoomProps {
  roomId: string;
  template: string;
  title: string;
  boardId?: string;
  isPublic?: boolean;
}

export function Room({ roomId, template, title, boardId, isPublic }: RoomProps) {
  const [ready, setReady] = useState(false);
  const [socketLive, setSocketLive] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
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

  useLayoutEffect(() => {
    if (!ready) return;
    acquireBoardSocket();
    joinBoardRoom(roomId);
  }, [ready, roomId]);

  useEffect(() => {
    if (!ready) return;

    let cancelled = false;
    let remoteUpdatedAt = 0;
    let currentUserId: string | null = null;

    void fetchCurrentUser().then((user) => {
      currentUserId = user?.id ?? null;
    });

    const pullRemote = async (options: { userId?: string; userName?: string; notify?: boolean } = {}) => {
      try {
        const remote = await apiFetch<{ canvasData: import("@/lib/types").BoardCanvasData | null; updatedAt: string }>(
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

    const onConnect = () => {
      if (!cancelled) setSocketLive(true);
      socket?.emit("board:join", { boardId: roomId });
    };
    const onDisconnect = () => {
      if (!cancelled) setSocketLive(false);
    };
    const onConnectError = () => {
      if (!cancelled) setSocketLive(false);
    };

    const onBoardUpdated = (event: BoardUpdatedEvent) => {
      if (event.boardId !== roomId) return;
      if (currentUserId && event.userId === currentUserId) return;
      void pullRemote({ userId: event.userId, userName: event.userName });
    };

    const onPresenceState = (users: unknown[]) => {
      if (!cancelled) setOnlineCount(users.length);
    };
    const onPresenceJoin = () => {
      if (!cancelled) setOnlineCount((count) => count + 1);
    };
    const onPresenceLeave = () => {
      if (!cancelled) setOnlineCount((count) => Math.max(0, count - 1));
    };

    const socket = getBoardSocket();
    if (socket) {
      socket.on("connect", onConnect);
      socket.on("disconnect", onDisconnect);
      socket.on("connect_error", onConnectError);
      socket.on("board:updated", onBoardUpdated);
      socket.on("presence:state", onPresenceState);
      socket.on("presence:join", onPresenceJoin);
      socket.on("presence:leave", onPresenceLeave);
      if (socket.connected) onConnect();
    }

    const pollInterval = setInterval(() => {
      void pullRemote();
    }, 8000);

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
      socket?.off("connect", onConnect);
      socket?.off("disconnect", onDisconnect);
      socket?.off("connect_error", onConnectError);
      socket?.off("board:updated", onBoardUpdated);
      socket?.off("presence:state", onPresenceState);
      socket?.off("presence:join", onPresenceJoin);
      socket?.off("presence:leave", onPresenceLeave);
      releaseBoardSocket();
    };
  }, [ready, roomId]);

  if (!ready) {
    return <RouteLoading label="Chargement du canvas..." />;
  }

  return (
    <>
      {socketLive && (
        <div
          className="pointer-events-none fixed bottom-3 left-3 z-[60] flex items-center gap-2"
        >
          <div
            className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-300"
            title="Collaboration temps réel active"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </div>
          {onlineCount > 0 && (
            <div className="rounded-full bg-neutral-900/80 px-2.5 py-1 text-[10px] font-medium text-white dark:bg-white/10">
              {onlineCount} en ligne
            </div>
          )}
        </div>
      )}
      <Canvas template={template} title={title} boardId={boardId} roomId={roomId} isPublic={isPublic} />
    </>
  );
}
