import { useState } from "react";
import { UserPlus, Link2, Copy, Check } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface InviteDialogProps {
  boardId: string;
}

export function InviteDialog({ boardId }: InviteDialogProps) {
  const [copied, setCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const inviteUrl = `${window.location.origin}/board/${boardId}`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    toast.success("Lien de collaboration copié");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-white/20" title="Inviter par lien">
          <UserPlus className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Inviter à collaborer
          </DialogTitle>
          <DialogDescription>
            Partagez ce lien. Toute personne connectée pourra rejoindre et éditer le tableau.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 pt-2">
          <Label className="text-xs text-neutral-500">Lien d&apos;invitation</Label>
          <div className="flex gap-2">
            <Input readOnly value={inviteUrl} className="text-xs font-mono" />
            <Button variant="outline" size="icon" onClick={copyLink} title="Copier le lien">
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-neutral-500">
            Le collaborateur doit avoir un compte Boardly. Il apparaîtra dans l&apos;équipe après avoir ouvert le lien.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
