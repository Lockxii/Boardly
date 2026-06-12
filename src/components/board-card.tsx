import { Link } from "@tanstack/react-router";
import { Clock, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TemplatePreview, getTemplateLabel } from "@/components/template-preview";
import type { Board } from "@/lib/types";

type BoardCardProps = {
  board: Board;
  onDelete?: (board: Board) => void;
};

export function BoardCard({ board, onDelete }: BoardCardProps) {
  const isOwner = board.isOwner !== false;

  return (
    <Link to="/board/$boardId" params={{ boardId: board.id }} className="group relative block">
      <article className="overflow-hidden rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/[0.06]">
        <div className="relative aspect-[16/10] overflow-hidden border-b border-neutral-200/80 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950">
          {board.thumbnail ? (
            <img
              src={board.thumbnail}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <TemplatePreview template={board.template} className="h-full w-full rounded-none border-0" />
          )}
          {!isOwner && (
            <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 dark:bg-neutral-900/90 px-2.5 py-1 text-[11px] font-semibold text-blue-700 dark:text-blue-300 shadow-sm">
              <Users className="h-3 w-3" />
              Partagé
            </span>
          )}
        </div>
        <div className="p-4">
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-neutral-900 dark:text-white group-hover:text-blue-600 transition-colors">
              {board.title}
            </h3>
            <p className="mt-1 text-xs text-neutral-500">
              Modèle {getTemplateLabel(board.template)}
              {!isOwner && board.authorName ? ` · par ${board.authorName}` : ""}
            </p>
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-neutral-400">
            <Clock className="h-3.5 w-3.5" />
            Modifié le {new Date(board.updatedAt).toLocaleDateString("fr-FR")}
          </p>
        </div>
      </article>

      {isOwner && onDelete && (
        <Button
          variant="destructive"
          size="icon"
          className="absolute top-3 right-3 h-8 w-8 rounded-full opacity-0 shadow-md transition-opacity group-hover:opacity-100"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete(board);
          }}
          title="Supprimer"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </Link>
  );
}

export function BoardCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 animate-pulse">
      <div className="aspect-[16/10] bg-neutral-100 dark:bg-neutral-800" />
      <div className="space-y-3 p-4">
        <div className="h-4 w-2/3 rounded bg-neutral-100 dark:bg-neutral-800" />
        <div className="h-3 w-1/3 rounded bg-neutral-100 dark:bg-neutral-800" />
      </div>
    </div>
  );
}
