import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FolderOpen, Tags } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/utils";
import { toast } from "sonner";
import type { Board } from "@/lib/types";

export function BoardMetaDialog({ board }: { board: Board }) {
  const [open, setOpen] = useState(false);
  const [folder, setFolder] = useState(board.folder || "");
  const [tags, setTags] = useState((board.tags || []).join(", "));
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch<Board>(`/api/boards/${board.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          folder: folder.trim() || null,
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boards"] });
      toast.success("Organisation mise à jour");
      setOpen(false);
    },
    onError: () => toast.error("Erreur de sauvegarde"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setFolder(board.folder || ""); setTags((board.tags || []).join(", ")); }}>
          Organiser
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Organiser « {board.title} »</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><FolderOpen className="h-4 w-4" />Dossier</Label>
            <Input value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="Ex: Clients, Perso…" />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Tags className="h-4 w-4" />Tags</Label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="design, campagne, q2" />
          </div>
          <Button className="w-full" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            Enregistrer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
