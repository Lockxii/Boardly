import { useEffect, useState } from "react";
import { Users, XCircle, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/utils";
import type { BoardMember } from "@/lib/types";

interface TeamDialogProps { boardId: string; }

export function TeamDialog({ boardId }: TeamDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: members = [], isLoading } = useQuery<BoardMember[]>({
    queryKey: ["boards", boardId, "members"],
    queryFn: () => apiFetch<BoardMember[]>(`/api/boards/${boardId}/members`),
    enabled: isOpen,
  });

  const removeMutation = useMutation({
    mutationFn: (email: string) => apiFetch(`/api/boards/${boardId}/members/${encodeURIComponent(email)}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["boards", boardId, "members"] }),
  });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-white/20">
          <Users className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Gestion de l'équipe
          </DialogTitle>
        </DialogHeader>
        <div className="py-4">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-neutral-400" /></div>
          ) : members.length === 0 ? (
            <p className="text-sm text-neutral-500 text-center py-8">Personne n&apos;a encore rejoint via le lien d&apos;invitation.</p>
          ) : (
            <div className="space-y-3">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium dark:text-white">{member.email}</span>
                    <span className="text-[10px] text-neutral-500 uppercase">{member.role}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                    onClick={() => {
                      if (confirm(`Retirer l'accès à ${member.email} ?`)) removeMutation.mutate(member.email);
                    }}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
