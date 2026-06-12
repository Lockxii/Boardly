import { useState, useEffect, useMemo } from "react";
import { Link2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { extractUrlsFromText, normalizeUrlInput } from "@/lib/clipboard-utils";

type LinkPasteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (urls: string[]) => Promise<void>;
  initialValue?: string;
};

export function LinkPasteDialog({ open, onOpenChange, onSubmit, initialValue = "" }: LinkPasteDialogProps) {
  const [value, setValue] = useState(initialValue);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);

  const urls = useMemo(() => extractUrlsFromText(value), [value]);
  const singleDraft = value.trim();
  const canSubmit = urls.length > 0 || (singleDraft.length > 0 && !!normalizeUrlInput(singleDraft));

  const handleSubmit = async () => {
    const resolved =
      urls.length > 0
        ? urls
        : normalizeUrlInput(singleDraft)
          ? [normalizeUrlInput(singleDraft)!]
          : [];
    if (resolved.length === 0) return;

    setLoading(true);
    try {
      await onSubmit(resolved);
      onOpenChange(false);
      setValue("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !loading && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-blue-600" />
            Coller des liens
          </DialogTitle>
          <DialogDescription>
            Un ou plusieurs liens — TikTok, YouTube, Spotify, articles… Colle plusieurs URLs (une par ligne) pour créer un moodboard instantané.
          </DialogDescription>
        </DialogHeader>

        <textarea
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={"https://tiktok.com/...\nhttps://open.spotify.com/track/...\nhttps://youtube.com/watch?v=..."}
          rows={5}
          className="w-full resize-none rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2 dark:border-neutral-700 dark:bg-neutral-900"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && canSubmit) {
              e.preventDefault();
              void handleSubmit();
            }
          }}
        />

        {urls.length > 0 && (
          <p className="text-xs text-neutral-500">
            {urls.length} lien{urls.length > 1 ? "s" : ""} détecté{urls.length > 1 ? "s" : ""}
          </p>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            Annuler
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={!canSubmit || loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {urls.length > 1 ? `Ajouter ${urls.length} liens` : "Ajouter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
