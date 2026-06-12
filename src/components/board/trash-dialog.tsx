import { Trash2, RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCanvasStore } from "@/store/canvas-store";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

export function TrashDialog() {
  const trash = useCanvasStore((s) => s.trash);
  const restoreTrashEntry = useCanvasStore((s) => s.restoreTrashEntry);
  const purgeTrash = useCanvasStore((s) => s.purgeTrash);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-white/20 relative" title="Corbeille">
          <Trash2 className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
          {trash.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center">
              {trash.length}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Corbeille
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-2 py-2">
          {trash.length === 0 ? (
            <p className="text-sm text-neutral-500 text-center py-8">La corbeille est vide.</p>
          ) : (
            trash.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between rounded-lg border border-neutral-200 dark:border-neutral-800 p-3">
                <div>
                  <p className="text-sm font-medium">{entry.layerIds.length} élément{entry.layerIds.length > 1 ? "s" : ""}</p>
                  <p className="text-xs text-neutral-500">{formatDistanceToNow(entry.deletedAt, { addSuffix: true, locale: fr })}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => restoreTrashEntry(entry.id)}>
                  <RotateCcw className="mr-1 h-3.5 w-3.5" />
                  Restaurer
                </Button>
              </div>
            ))
          )}
        </div>
        {trash.length > 0 && (
          <Button variant="ghost" size="sm" className="text-neutral-500" onClick={purgeTrash}>
            Purger les éléments de plus de 30 jours
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
