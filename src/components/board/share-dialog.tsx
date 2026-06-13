import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe, Link2, Copy, Check, Users, XCircle, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/utils";
import { toast } from "sonner";
import type { Board, BoardMember } from "@/lib/types";
import { NavIconButton } from "./nav-icon-button";

export function ShareDialog({
  boardId,
  isPublic = false,
  iconOnly = false,
  canManage = false,
}: {
  boardId: string;
  isPublic?: boolean;
  iconOnly?: boolean;
  canManage?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [publicEnabled, setPublicEnabled] = useState(isPublic);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [copiedPublic, setCopiedPublic] = useState(false);
  const queryClient = useQueryClient();

  const inviteUrl = `${window.location.origin}/board/${boardId}`;
  const publicUrl = `${window.location.origin}/share/${boardId}`;

  useEffect(() => {
    if (!boardId) return;
    void queryClient.prefetchQuery({
      queryKey: ["boards", boardId, "members"],
      queryFn: () => apiFetch<BoardMember[]>(`/api/boards/${boardId}/members`),
      staleTime: 5 * 60 * 1000,
    });
  }, [boardId, queryClient]);

  useEffect(() => {
    setPublicEnabled(isPublic);
  }, [isPublic]);

  const { data: members = [], isLoading: membersLoading, isFetching } = useQuery<BoardMember[]>({
    queryKey: ["boards", boardId, "members"],
    queryFn: () => apiFetch<BoardMember[]>(`/api/boards/${boardId}/members`),
    enabled: open && !!boardId,
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  });

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

  const removeMutation = useMutation({
    mutationFn: (email: string) => apiFetch(`/api/boards/${boardId}/members/${encodeURIComponent(email)}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["boards", boardId, "members"] }),
  });

  const copyInvite = async () => {
    await navigator.clipboard.writeText(inviteUrl);
    setCopiedInvite(true);
    toast.success("Lien de collaboration copié");
    setTimeout(() => setCopiedInvite(false), 2000);
  };

  const copyPublic = async () => {
    await navigator.clipboard.writeText(publicUrl);
    setCopiedPublic(true);
    setTimeout(() => setCopiedPublic(false), 2000);
  };

  const showMembersLoader = membersLoading && members.length === 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {iconOnly ? (
          <NavIconButton title="Partager" className="text-blue-600 dark:text-blue-400">
            <Globe className="h-5 w-5" />
          </NavIconButton>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-2 bg-white/10 text-blue-600 border-blue-200/50 dark:border-blue-800/50 dark:text-blue-400 transition-colors duration-150 active:bg-blue-50 dark:active:bg-blue-950/30"
          >
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">Partager</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Partager ce tableau
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2 overflow-y-auto">
          <section className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Collaborateurs</Label>
            <p className="text-xs text-neutral-500">Toute personne connectée avec ce lien peut éditer le board.</p>
            {!canManage && (
              <p className="text-xs text-neutral-500">Vous pouvez modifier le contenu, mais seul le propriétaire gère les accès.</p>
            )}
            <div className="flex gap-2">
              <Input readOnly value={inviteUrl} className="text-xs font-mono" />
              <Button variant="outline" size="icon" onClick={copyInvite} title="Copier le lien">
                {copiedInvite ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </section>

          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-neutral-500" />
              <Label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Équipe</Label>
              {isFetching && members.length > 0 && <Loader2 className="h-3 w-3 animate-spin text-neutral-400" />}
            </div>
            {showMembersLoader ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
              </div>
            ) : members.length === 0 ? (
              <p className="text-xs text-neutral-500 rounded-lg border border-dashed border-neutral-200 dark:border-neutral-800 p-4 text-center">
                Personne n&apos;a encore rejoint via le lien.
              </p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate dark:text-white">{member.email}</p>
                      <p className="text-[10px] text-neutral-500 uppercase">{member.role}</p>
                    </div>
                    {canManage && (
                      <NavIconButton
                        className="h-8 w-8 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 shrink-0"
                        title="Retirer"
                        onClick={() => {
                          if (confirm(`Retirer l'accès à ${member.email} ?`)) removeMutation.mutate(member.email);
                        }}
                      >
                        <XCircle className="h-4 w-4" />
                      </NavIconButton>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="h-px bg-neutral-200 dark:bg-neutral-800" />

          <section className="space-y-3">
            <Label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Lien public</Label>
            <div className="flex items-center justify-between rounded-xl border border-neutral-200 dark:border-neutral-800 p-4">
              <div>
                <p className="font-medium text-sm">Lecture seule</p>
                <p className="text-xs text-neutral-500 mt-1">Visible sans compte.</p>
              </div>
              <Button
                variant={publicEnabled ? "default" : "outline"}
                size="sm"
                disabled={!canManage || patchMutation.isPending}
                onClick={() => patchMutation.mutate(!publicEnabled)}
              >
                {publicEnabled ? "Activé" : "Activer"}
              </Button>
            </div>
            {publicEnabled && (
              <div className="flex gap-2">
                <Input readOnly value={publicUrl} className="text-xs font-mono" />
                <Button variant="outline" size="icon" onClick={copyPublic}>
                  {copiedPublic ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
