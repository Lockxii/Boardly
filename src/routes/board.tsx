import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { apiFetch } from "@/lib/utils";
import { Room } from "@/components/board/room";
import { RouteLoading } from "@/components/route-loading";
import { BoardlyBrand } from "@/components/boardly-brand";
import { Button } from "@/components/ui/button";
import type { Board } from "@/lib/types";

export function BoardPage() {
  const { boardId } = useParams({ from: "/board/$boardId" });

  const { data: board, isLoading, error } = useQuery<Board>({
    queryKey: ["boards", boardId],
    queryFn: async () => {
      try {
        return await apiFetch<Board>(`/api/boards/${boardId}`);
      } catch (e) {
        const message = e instanceof Error ? e.message : "";
        if (message !== "Accès refusé") throw e;
        await apiFetch(`/api/boards/${boardId}/join`, { method: "POST" });
        return apiFetch<Board>(`/api/boards/${boardId}`);
      }
    },
  });

  if (isLoading) {
    return <RouteLoading label="Ouverture du tableau..." />;
  }

  if (error || !board) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#FDFCF8] dark:bg-[#0A0A0A] px-6 text-center gap-6">
        <BoardlyBrand to="/dashboard" className="text-xl" />
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Tableau introuvable</h1>
          <p className="text-neutral-500 max-w-md">
            Ce tableau n&apos;existe pas, a été supprimé, ou vous n&apos;y avez pas accès.
          </p>
        </div>
        <Button asChild className="rounded-full">
          <Link to="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour au dashboard
          </Link>
        </Button>
      </div>
    );
  }

  return <Room roomId={board.id} template={board.template || "blank"} title={board.title} boardId={boardId} isPublic={board.isPublic} />;
}
