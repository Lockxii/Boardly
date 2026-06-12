import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Layout, Search, ArrowUpDown, Sparkles } from "lucide-react";
import { apiFetch } from "@/lib/utils";
import { authClient, fetchCurrentUser } from "@/lib/auth-client";
import { AppShell } from "@/components/app-shell";
import { BoardCard, BoardCardSkeleton, CreateBoardCard } from "@/components/board-card";
import { NewBoardDialog } from "@/components/new-board-dialog";
import { DeleteBoardDialog } from "@/components/delete-board-dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Board, User as UserType } from "@/lib/types";

type SortKey = "updated" | "title" | "created";

function BoardSection({
  title,
  count,
  boards,
  onDelete,
  onDuplicate,
  showCreate,
  onCreateClick,
}: {
  title: string;
  count: number;
  boards: Board[];
  onDelete?: (board: Board) => void;
  onDuplicate?: (board: Board) => void;
  showCreate?: boolean;
  onCreateClick?: () => void;
}) {
  if (boards.length === 0 && !showCreate) return null;

  return (
    <section className="space-y-5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">
          {title}
        </h2>
        <span className="text-xs font-medium text-neutral-400">{count}</span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {showCreate && onCreateClick && <CreateBoardCard onClick={onCreateClick} />}
        {boards.map((board) => (
          <BoardCard key={board.id} board={board} onDelete={onDelete} onDuplicate={onDuplicate} />
        ))}
      </div>
    </section>
  );
}

export function DashboardPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [boardToDelete, setBoardToDelete] = useState<Board | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("updated");
  const [folderFilter, setFolderFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);

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

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => apiFetch<Board>(`/api/boards/${id}/duplicate`, { method: "POST" }),
    onSuccess: (board) => {
      queryClient.invalidateQueries({ queryKey: ["boards"] });
      toast.success("Tableau dupliqué");
      navigate({ to: "/board/$boardId", params: { boardId: board.id } });
    },
    onError: () => toast.error("Impossible de dupliquer le tableau"),
  });

  const sortBoards = (list: Board[]) => {
    const sorted = [...list];
    if (sortKey === "title") sorted.sort((a, b) => a.title.localeCompare(b.title, "fr"));
    else if (sortKey === "created") sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    else sorted.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return sorted;
  };

  const folders = Array.from(new Set(boards.map((b) => b.folder).filter(Boolean))) as string[];

  const normalizedQuery = searchQuery.toLowerCase();
  const filterBoard = (board: Board) => {
    if (folderFilter !== "all" && (board.folder || "") !== folderFilter) return false;
    return board.title.toLowerCase().includes(normalizedQuery);
  };

  const ownedBoards = sortBoards(boards.filter((b) => b.isOwner !== false).filter(filterBoard));
  const sharedBoards = sortBoards(boards.filter((b) => b.isOwner === false).filter(filterBoard));
  const hasResults = ownedBoards.length > 0 || sharedBoards.length > 0;
  const ownedCount = boards.filter((b) => b.isOwner !== false).length;

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
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreate={(title, template) => createMutation.mutate({ title, template })}
          isLoading={createMutation.isPending}
        />
      }
    >
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="relative overflow-hidden rounded-3xl border border-neutral-200/70 bg-white/70 px-6 py-8 shadow-sm shadow-black/[0.03] backdrop-blur-md dark:border-neutral-800/80 dark:bg-neutral-900/50 sm:px-8">
          <div
            className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-blue-400/10 blur-3xl dark:bg-blue-500/10"
            aria-hidden
          />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                <Sparkles className="h-3 w-3" />
                Espace de travail
              </p>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
                {firstName ? `Bon retour, ${firstName}` : "Bon retour"}
              </h1>
              <p className="mt-2 text-sm text-neutral-500 sm:text-base">
                Reprenez un moodboard, collez vos refs, ou partez d&apos;un canvas vierge.
              </p>
            </div>
            {!isLoading && boards.length > 0 && (
              <div className="flex shrink-0 gap-6 border-t border-neutral-200/80 pt-4 lg:border-t-0 lg:border-l lg:pl-8 lg:pt-0 dark:border-neutral-800">
                <div>
                  <p className="text-2xl font-bold tabular-nums">{ownedCount}</p>
                  <p className="text-xs text-neutral-500">Tableaux</p>
                </div>
                <div>
                  <p className="text-2xl font-bold tabular-nums">{sharedBoards.length}</p>
                  <p className="text-xs text-neutral-500">Partagés</p>
                </div>
              </div>
            )}
          </div>
        </section>

        {boards.length > 0 && (
          <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200/70 bg-white/80 p-3 shadow-sm backdrop-blur-sm dark:border-neutral-800/80 dark:bg-neutral-900/60 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <Input
                placeholder="Rechercher un tableau…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 rounded-xl border-neutral-200/80 bg-white pl-9 dark:border-neutral-700 dark:bg-neutral-950"
              />
            </div>
            <div className="flex gap-2">
              <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
                <SelectTrigger className="h-10 w-full rounded-xl bg-white sm:w-44 dark:bg-neutral-950">
                  <ArrowUpDown className="mr-2 h-4 w-4 shrink-0 text-neutral-400" />
                  <SelectValue placeholder="Trier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="updated">Modifié récemment</SelectItem>
                  <SelectItem value="created">Créé récemment</SelectItem>
                  <SelectItem value="title">Titre A–Z</SelectItem>
                </SelectContent>
              </Select>
              {folders.length > 0 && (
                <Select value={folderFilter} onValueChange={setFolderFilter}>
                  <SelectTrigger className="h-10 w-full rounded-xl bg-white sm:w-40 dark:bg-neutral-950">
                    <SelectValue placeholder="Dossier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    {folders.map((folder) => (
                      <SelectItem key={folder} value={folder}>{folder}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <BoardCardSkeleton key={i} />
            ))}
          </div>
        ) : boards.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-neutral-200/70 bg-white/60 px-6 py-24 text-center dark:border-neutral-800 dark:bg-neutral-900/40">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-950/60 dark:to-indigo-950/40">
              <Layout className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-xl font-semibold tracking-tight">Ton premier moodboard t&apos;attend</h2>
            <p className="mt-2 max-w-md text-sm text-neutral-500">
              Colle des liens TikTok, des refs visuelles, des notes — tout sur un canvas infini.
            </p>
            <div className="mt-8">
              <NewBoardDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                onCreate={(title, template) => createMutation.mutate({ title, template })}
                isLoading={createMutation.isPending}
                triggerLabel="Créer mon premier tableau"
              />
            </div>
          </div>
        ) : !hasResults ? (
          <div className="rounded-2xl border border-neutral-200/70 bg-white/70 py-16 text-center dark:border-neutral-800 dark:bg-neutral-900/50">
            <p className="text-neutral-500">Aucun tableau pour « {searchQuery} »</p>
          </div>
        ) : (
          <div className="space-y-12">
            <BoardSection
              title="Mes tableaux"
              count={ownedBoards.length}
              boards={ownedBoards}
              showCreate
              onCreateClick={() => setCreateOpen(true)}
              onDelete={setBoardToDelete}
              onDuplicate={(board) => duplicateMutation.mutate(board.id)}
            />
            <BoardSection
              title="Partagés avec moi"
              count={sharedBoards.length}
              boards={sharedBoards}
            />
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
