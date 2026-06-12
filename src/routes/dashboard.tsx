import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Layout, Search } from "lucide-react";
import { apiFetch } from "@/lib/utils";
import { authClient, fetchCurrentUser } from "@/lib/auth-client";
import { AppShell } from "@/components/app-shell";
import { BoardCard, BoardCardSkeleton } from "@/components/board-card";
import { NewBoardDialog } from "@/components/new-board-dialog";
import { DeleteBoardDialog } from "@/components/delete-board-dialog";
import { Input } from "@/components/ui/input";
import type { Board, User as UserType } from "@/lib/types";

export function DashboardPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [boardToDelete, setBoardToDelete] = useState<Board | null>(null);

  const { data: user } = useQuery<UserType | null>({
    queryKey: ["auth", "me"],
    queryFn: fetchCurrentUser,
  });

  const { data: boards = [], isLoading } = useQuery<Board[]>({
    queryKey: ["boards"],
    queryFn: () => apiFetch<Board[]>("/api/boards"),
  });

  const createMutation = useMutation({
    mutationFn: (data: { title: string; template: string }) =>
      apiFetch<Board>("/api/boards", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (board) => {
      queryClient.invalidateQueries({ queryKey: ["boards"] });
      toast.success("Tableau créé");
      navigate({ to: "/board/$boardId", params: { boardId: board.id } });
    },
    onError: () => toast.error("Impossible de créer le tableau"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/boards/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boards"] });
      toast.success("Tableau supprimé");
      setBoardToDelete(null);
    },
    onError: () => toast.error("Impossible de supprimer le tableau"),
  });

  const filteredBoards = boards.filter((b) =>
    b.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const firstName = user?.name?.split(" ")[0];

  const handleSignOut = async () => {
    await authClient.signOut();
    queryClient.setQueryData(["auth", "me"], null);
    navigate({ to: "/" });
  };

  return (
    <AppShell
      user={user}
      onSignOut={handleSignOut}
      actions={
        <NewBoardDialog
          onCreate={(title, template) => createMutation.mutate({ title, template })}
          isLoading={createMutation.isPending}
        />
      }
    >
      <div className="mx-auto max-w-6xl space-y-8">
        <section>
          <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-1">Espace de travail</p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            {firstName ? `Bon retour, ${firstName}` : "Bon retour"}
          </h1>
          <p className="mt-2 text-neutral-500 max-w-xl">
            Retrouvez vos tableaux, reprenez là où vous vous étiez arrêté, ou lancez un nouveau projet.
          </p>
        </section>

        {boards.length > 0 && (
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input
              placeholder="Rechercher un tableau..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-xl pl-9 bg-white/80 dark:bg-neutral-900/80"
            />
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <BoardCardSkeleton key={i} />
            ))}
          </div>
        ) : boards.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-neutral-200 dark:border-neutral-800 bg-white/60 dark:bg-neutral-900/40 px-6 py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950/40">
              <Layout className="h-8 w-8 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold">Votre premier tableau vous attend</h2>
            <p className="mt-2 max-w-md text-neutral-500">
              Brainstormez, dessinez et organisez vos idées sur un canvas infini.
            </p>
            <div className="mt-6">
              <NewBoardDialog
                onCreate={(title, template) => createMutation.mutate({ title, template })}
                isLoading={createMutation.isPending}
                triggerLabel="Créer mon premier tableau"
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredBoards.map((board) => (
              <BoardCard key={board.id} board={board} onDelete={setBoardToDelete} />
            ))}

            {filteredBoards.length === 0 && (
              <div className="col-span-full rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/50 py-12 text-center">
                <p className="text-neutral-500">
                  Aucun tableau ne correspond à « {searchQuery} »
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <DeleteBoardDialog
        board={boardToDelete}
        open={!!boardToDelete}
        onOpenChange={(open) => !open && setBoardToDelete(null)}
        onConfirm={() => boardToDelete && deleteMutation.mutate(boardToDelete.id)}
        isLoading={deleteMutation.isPending}
      />
    </AppShell>
  );
}
