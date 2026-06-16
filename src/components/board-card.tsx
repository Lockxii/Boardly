import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Clock, Trash2, Users, Copy, Plus, FolderOpen } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { TemplatePreview } from "@/components/template-preview";
import { getTemplateLabel } from "@/lib/template-styles";
import { BoardMetaDialog } from "@/components/board-meta-dialog";
import type { Board } from "@/lib/types";

type BoardCardProps = {
  board: Board;
  onDelete?: (board: Board) => void;
  onDuplicate?: (board: Board) => void;
};

function formatRelativeDate(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const days = Math.floor(diff / 86400000);
  if (days <= 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  if (days < 7) return `Il y a ${days} j`;
  return new Date(date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export function CreateBoardCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex h-full min-h-[220px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-neutral-300/80 bg-white/50 p-6 text-center transition-all duration-300 hover:border-blue-400/60 hover:bg-blue-50/40 hover:shadow-lg hover:shadow-blue-500/[0.06] dark:border-neutral-700 dark:bg-neutral-900/30 dark:hover:border-blue-500/40 dark:hover:bg-blue-950/20"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-500 transition-colors group-hover:bg-blue-100 group-hover:text-blue-600 dark:bg-neutral-800 dark:group-hover:bg-blue-900/40 dark:group-hover:text-blue-400">
        <Plus className="h-5 w-5" />
      </div>
      <div>
        <p className="font-semibold text-neutral-800 dark:text-neutral-100">Nouveau tableau</p>
        <p className="mt-1 text-xs text-neutral-500">Canvas vierge ou modèle</p>
      </div>
    </button>
  );
}

export function BoardCard({ board, onDelete, onDuplicate }: BoardCardProps) {
  const isOwner = board.isOwner !== false;
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      to="/board/$boardId"
      params={{ boardId: board.id }}
      className="group relative block h-full"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200/70 bg-white/90 shadow-sm ring-1 ring-black/[0.02] backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-neutral-300/80 hover:shadow-xl hover:shadow-black/[0.07] dark:border-neutral-800/80 dark:bg-neutral-900/90 dark:ring-white/[0.03] dark:hover:border-neutral-700">
        <div className="relative aspect-[5/3] overflow-hidden bg-neutral-100/80 dark:bg-neutral-950">
          <motion.div
            className="h-full w-full origin-center"
            animate={{ scale: hovered ? 1.04 : 1 }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
          >
            {board.thumbnail ? (
              <img src={board.thumbnail} alt="" className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <TemplatePreview template={board.template} className="h-full w-full rounded-none border-0" />
            )}
          </motion.div>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          {!isOwner && (
            <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-blue-700 shadow-sm dark:bg-neutral-900/95 dark:text-blue-300">
              <Users className="h-3 w-3" />
              Partagé
            </span>
          )}
          {board.folder && (
            <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
              <FolderOpen className="h-3 w-3" />
              {board.folder}
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col p-4">
          <h3 className="truncate text-[15px] font-semibold tracking-tight text-neutral-900 transition-colors group-hover:text-blue-600 dark:text-white">
            {board.title}
          </h3>
          <p className="mt-1 text-xs text-neutral-500">
            {getTemplateLabel(board.template)}
            {!isOwner && board.authorName ? ` · ${board.authorName}` : ""}
          </p>
          <div className="mt-auto flex items-center justify-between pt-3">
            <p className="flex items-center gap-1 text-[11px] text-neutral-400">
              <Clock className="h-3 w-3" />
              {formatRelativeDate(board.updatedAt)}
            </p>
            {isOwner && (
              <div onClick={(e) => e.preventDefault()}>
                <BoardMetaDialog board={board} />
              </div>
            )}
          </div>
        </div>
      </article>

      {isOwner && (onDelete || onDuplicate) && (
        <div className="absolute right-3 top-3 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {onDuplicate && (
            <Button
              variant="secondary"
              size="icon"
              className="h-8 w-8 rounded-full border-0 bg-white/95 shadow-md backdrop-blur-sm hover:bg-white dark:bg-neutral-900/95"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDuplicate(board);
              }}
              title="Dupliquer"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="destructive"
              size="icon"
              className="h-8 w-8 rounded-full shadow-md"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete(board);
              }}
              title="Supprimer"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}
    </Link>
  );
}

export function BoardCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200/70 bg-white/90 dark:border-neutral-800 dark:bg-neutral-900 animate-pulse">
      <div className="aspect-[5/3] bg-neutral-100 dark:bg-neutral-800" />
      <div className="space-y-3 p-4">
        <div className="h-4 w-2/3 rounded bg-neutral-100 dark:bg-neutral-800" />
        <div className="h-3 w-1/3 rounded bg-neutral-100 dark:bg-neutral-800" />
      </div>
    </div>
  );
}
