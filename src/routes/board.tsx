import { useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/utils";
import { Room } from "@/components/board/room";
import { Loader2 } from "lucide-react";
import type { Board } from "@/lib/types";

export function BoardPage() {
  const { boardId } = useParams({ from: "/board/$boardId" });

  const { data: board, isLoading, error } = useQuery<Board>({
    queryKey: ["boards", boardId],
    queryFn: () => apiFetch<Board>(`/api/boards/${boardId}`),
  });

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-950 text-neutral-400">
        <Loader2 className="h-10 w-10 animate-spin" />
      </div>
    );
  }

  if (error || !board) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-neutral-100 dark:bg-neutral-950 gap-4">
        <p className="text-neutral-500">Impossible de charger ce tableau.</p>
        <a href="/dashboard" className="text-blue-500 underline">Retour au dashboard</a>
      </div>
    );
  }

  return <Room roomId={board.id} template={board.template || "blank"} title={board.title} boardId={boardId} />;
}
