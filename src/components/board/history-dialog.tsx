import { useCanvasStore } from "@/store/canvas-store";
import { History, Clock, User } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

export function HistoryDialog() {
  const auditLog = useCanvasStore((s) => s.auditLog);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-white/20">
          <History className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Historique des modifications
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto py-4">
          {auditLog.length === 0 ? (
            <p className="text-sm text-neutral-500 text-center py-8">Aucune modification enregistrée.</p>
          ) : (
            <div className="space-y-4">
              {[...auditLog].reverse().map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                  <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                  </div>
                  <div className="flex flex-col gap-0.5 flex-1">
                    <div className="text-sm">
                      <span className="font-bold text-blue-600 dark:text-blue-400">{entry.userName}</span>{" "}
                      <span className="text-neutral-700 dark:text-neutral-300">
                        {entry.action === "created" && `a créé un(e) ${entry.layerType}`}
                        {entry.action === "deleted" && `a supprimé un(e) ${entry.layerType}`}
                        {entry.action === "moved" && `a déplacé un(e) ${entry.layerType}`}
                        {entry.action === "modified" && `a modifié un(e) ${entry.layerType}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-neutral-500 uppercase font-bold mt-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(entry.timestamp, { addSuffix: true, locale: fr })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
