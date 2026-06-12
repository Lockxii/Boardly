import { Link } from "@tanstack/react-router";
import { Clock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TemplatePreview, getTemplateLabel } from "@/components/template-preview";
import type { Board } from "@/lib/types";

type BoardCardProps = {
  board: Board;
  onDelete: (board: Board) => void;
};

export function BoardCard({ board, onDelete }: BoardCardProps) {
  return (
    <Link to="/board/$boardId" params={{ boardId: board.id }} className="group relative block">
      <article className="overflow-hidden rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/[0.06]">
        <TemplatePreview template={board.template} className="aspect-[16/10] rounded-none border-0 border-b border-neutral-200/80 dark:border-neutral-800" />
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate font-semibold text-neutral-900 dark:text-white group-hover:text-blue-600 transition-colors">
                {board.title}
              </h3>
              <p className="mt-1 text-xs text-neutral-500">Modèle {getTemplateLabel(board.template)}</p>
            </div>
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-neutral-400">
            <Clock className="h-3.5 w-3.5" />
            Modifié le {new Date(board.updatedAt).toLocaleDateString("fr-FR")}
          </p>
        </div>
      </article>

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
