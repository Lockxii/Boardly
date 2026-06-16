import { useState } from "react";
import { MessageSquare, Send, Trash2, X, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCanvasStore } from "@/store/canvas-store";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { NavIconButton } from "./nav-icon-button";
import { useDraggable } from "@/lib/use-draggable";

export function LayerCommentsPanel() {
  const commentsPanelOpen = useCanvasStore((s) => s.commentsPanelOpen);
  const commentsLayerId = useCanvasStore((s) => s.commentsLayerId);
  const layerComments = useCanvasStore((s) => s.layerComments);
  const addLayerComment = useCanvasStore((s) => s.addLayerComment);
  const deleteLayerComment = useCanvasStore((s) => s.deleteLayerComment);
  const closeCommentsPanel = useCanvasStore((s) => s.closeCommentsPanel);
  const readOnly = useCanvasStore((s) => s.readOnly);
  const [text, setText] = useState("");
  const drag = useDraggable<HTMLDivElement>({ storageKey: "layer-comments" });

  if (!commentsPanelOpen || !commentsLayerId) return null;

  const comments = layerComments[commentsLayerId] || [];

  const submit = () => {
    if (!text.trim()) return;
    addLayerComment(commentsLayerId, text);
    setText("");
  };

  return (
    <div ref={drag.ref} style={drag.style} className="absolute top-22 left-4 w-72 max-h-80 flex flex-col rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md shadow-xl z-40 pointer-events-auto animate-in fade-in slide-in-from-left-2 duration-200">
      <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-neutral-700 px-3 py-2">
        <div {...drag.handleProps} className="-ml-1 text-neutral-300 dark:text-neutral-600" title="Déplacer"><GripVertical className="h-4 w-4" /></div>
        <MessageSquare className="h-4 w-4 text-blue-600" />
        <span className="text-sm font-medium">Commentaires</span>
        <span className="text-xs text-neutral-400">{comments.length}</span>
        <NavIconButton className="ml-auto h-7 w-7" title="Fermer" onClick={closeCommentsPanel}>
          <X className="h-4 w-4" />
        </NavIconButton>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[80px]">
        {comments.length === 0 ? (
          <p className="text-xs text-neutral-500 text-center py-4">Aucun commentaire sur cet élément.</p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="rounded-lg bg-neutral-50 dark:bg-neutral-800 p-2 text-xs">
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-blue-600">{c.userName}</span>
                {!readOnly && (
                  <button type="button" className="text-neutral-400 hover:text-red-500" onClick={() => deleteLayerComment(commentsLayerId, c.id)}>
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
              <p className="mt-1 text-neutral-700 dark:text-neutral-300">{c.text}</p>
              <p className="mt-1 text-[10px] text-neutral-400">{formatDistanceToNow(c.createdAt, { addSuffix: true, locale: fr })}</p>
            </div>
          ))
        )}
      </div>
      {!readOnly && (
        <div className="flex gap-2 border-t border-neutral-200 dark:border-neutral-700 p-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ajouter un commentaire…"
            className="h-8 text-xs"
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <Button size="icon" className="h-8 w-8 shrink-0" onClick={submit}>
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
