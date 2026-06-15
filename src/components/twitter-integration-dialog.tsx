import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Loader2, RefreshCw, Twitter } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Board, BoardCanvasData } from "@/lib/types";

type TwitterStatus = {
  configured: boolean;
  connected: boolean;
  accountId?: string | null;
  boardId?: string | null;
  boardUpdatedAt?: string | null;
};

type TwitterImportResult = {
  board: Board;
  canvasData: BoardCanvasData;
  updatedAt: string;
  importedCount: number;
};

type TwitterIntegrationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function TwitterIntegrationDialog({ open, onOpenChange }: TwitterIntegrationDialogProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: status, isLoading } = useQuery<TwitterStatus>({
    queryKey: ["integrations", "twitter"],
    queryFn: () => apiFetch<TwitterStatus>("/api/integrations/twitter/status"),
    enabled: open,
  });

  const importMutation = useMutation({
    mutationFn: () =>
      apiFetch<TwitterImportResult>("/api/integrations/twitter/import", {
        method: "POST",
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["boards"] });
      queryClient.invalidateQueries({ queryKey: ["integrations", "twitter"] });
      toast.success(`${result.importedCount} tweet${result.importedCount > 1 ? "s" : ""} importé${result.importedCount > 1 ? "s" : ""}`);
      onOpenChange(false);
      navigate({ to: "/board/$boardId", params: { boardId: result.board.id } });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Import Twitter impossible");
    },
  });

  const connected = !!status?.connected;
  const hasBoard = !!status?.boardId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden rounded-3xl p-0 sm:max-w-[620px]">
        <div className="grid sm:grid-cols-[190px_1fr]">
          <aside className="border-b border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-950 sm:border-b-0 sm:border-r">
            <DialogHeader className="text-left">
              <DialogTitle>Intégrations</DialogTitle>
              <DialogDescription>Commencez avec Twitter.</DialogDescription>
            </DialogHeader>
            <div className="mt-5 flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm dark:bg-neutral-900">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-white">
                <Twitter className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">Twitter / X</p>
                <p className="text-xs text-neutral-500">Bookmarks</p>
              </div>
            </div>
          </aside>

          <div className="p-6">
            {isLoading ? (
              <div className="flex min-h-48 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
              </div>
            ) : !status?.configured ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                  Ajoutez `TWITTER_CLIENT_ID` et `TWITTER_CLIENT_SECRET` pour activer la connexion Twitter.
                </div>
                <Button disabled className="w-full rounded-xl">
                  Connecter Twitter
                </Button>
              </div>
            ) : !connected ? (
              <div className="space-y-5">
                <div>
                  <h3 className="text-lg font-semibold tracking-tight">Connecter Twitter</h3>
                  <p className="mt-2 text-sm text-neutral-500">
                    Boardly importera vos tweets sauvegardés dans un seul board Twitter.
                  </p>
                </div>
                <Button
                  className="w-full rounded-xl bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
                  onClick={() => {
                    window.location.href = "/api/integrations/twitter/start";
                  }}
                >
                  <Twitter className="h-4 w-4" />
                  Connecter Twitter
                </Button>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex items-start gap-3 rounded-2xl border border-green-200 bg-green-50 p-4 dark:border-green-900/60 dark:bg-green-950/30">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600 dark:text-green-400" />
                  <div>
                    <p className="font-medium text-green-900 dark:text-green-200">Twitter connecté</p>
                    <p className="text-sm text-green-700/80 dark:text-green-300/80">
                      {hasBoard ? "Votre board Twitter existe déjà." : "Prêt à créer votre board Twitter."}
                    </p>
                  </div>
                </div>

                <Button
                  className="w-full rounded-xl"
                  disabled={importMutation.isPending}
                  onClick={() => importMutation.mutate()}
                >
                  {importMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {hasBoard ? "Synchronisation..." : "Création du board..."}
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      {hasBoard ? "Synchroniser les tweets" : "Importer les tweets"}
                    </>
                  )}
                </Button>

                {hasBoard && status.boardId && (
                  <Button
                    variant="outline"
                    className="w-full rounded-xl"
                    onClick={() => {
                      onOpenChange(false);
                      navigate({ to: "/board/$boardId", params: { boardId: status.boardId! } });
                    }}
                  >
                    Ouvrir le board Twitter
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
