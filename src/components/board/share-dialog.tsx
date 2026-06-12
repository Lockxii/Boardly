import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Globe, Link2, Copy, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/utils";
import { toast } from "sonner";
import type { Board } from "@/lib/types";

export function ShareDialog({ boardId, isPublic = false }: { boardId: string; isPublic?: boolean }) {
  const [open, setOpen] = useState(false);
  const [publicEnabled, setPublicEnabled] = useState(isPublic);
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();

  const publicUrl = `${window.location.origin}/share/${boardId}`;

  const patchMutation = useMutation({
    mutationFn: (next: boolean) =>
      apiFetch<Board>(`/api/boards/${boardId}`, {
        method: "PATCH",
        body: JSON.stringify({ isPublic: next }),
      }),
    onSuccess: (board) => {
      setPublicEnabled(!!board.isPublic);
      queryClient.invalidateQueries({ queryKey: ["boards", boardId] });
      toast.success(board.isPublic ? "Lien public activé" : "Lien public désactivé");
    },
    onError: () => toast.error("Impossible de mettre à jour le partage"),
  });

  const copyPublic = async () => {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-2 bg-white/10 text-blue-600 border-blue-200/50 dark:border-blue-800/50 dark:text-blue-400">
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline">Partager</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Partager ce tableau
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between rounded-xl border border-neutral-200 dark:border-neutral-800 p-4">
            <div>
              <p className="font-medium text-sm">Lien public lecture seule</p>
              <p className="text-xs text-neutral-500 mt-1">Toute personne avec le lien peut voir le board sans compte.</p>
            </div>
            <Button
              variant={publicEnabled ? "default" : "outline"}
              size="sm"
              disabled={patchMutation.isPending}
              onClick={() => patchMutation.mutate(!publicEnabled)}
            >
              {publicEnabled ? "Activé" : "Activer"}
            </Button>
          </div>
          {publicEnabled && (
            <div className="space-y-2">
              <Label className="text-xs text-neutral-500">Lien public</Label>
              <div className="flex gap-2">
                <Input readOnly value={publicUrl} className="text-xs" />
                <Button variant="outline" size="icon" onClick={copyPublic}>
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
