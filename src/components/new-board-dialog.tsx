import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TemplatePreview } from "@/components/template-preview";
import { cn } from "@/lib/utils";

const TEMPLATES = [
  { key: "blank", label: "Vide" },
  { key: "grid", label: "Grille" },
  { key: "blueprint", label: "Plan" },
] as const;

type NewBoardDialogProps = {
  onCreate: (title: string, template: string) => void;
  isLoading?: boolean;
  triggerVariant?: "default" | "outline";
  triggerLabel?: string;
};

export function NewBoardDialog({
  onCreate,
  isLoading,
  triggerVariant = "default",
  triggerLabel = "Nouveau tableau",
}: NewBoardDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("blank");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate(title || "Sans titre", selectedTemplate);
    setOpen(false);
    setTitle("");
    setSelectedTemplate("blank");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={triggerVariant}
          className={cn(
            triggerVariant === "default" &&
              "rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 shadow-lg shadow-black/10"
          )}
        >
          <Plus className="h-4 w-4 mr-2" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[620px] rounded-3xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Créer un tableau</DialogTitle>
            <DialogDescription>Choisissez un modèle pour démarrer votre prochain projet.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 py-4">
            <div className="space-y-2">
              <Label htmlFor="board-title">Titre</Label>
              <Input
                id="board-title"
                placeholder="Mon super projet"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Modèle</Label>
              <div className="grid grid-cols-3 gap-3">
                {TEMPLATES.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedTemplate(key)}
                    className={cn(
                      "rounded-2xl border-2 p-2 text-left transition-all hover:border-blue-400",
                      selectedTemplate === key
                        ? "border-blue-600 bg-blue-50/60 dark:bg-blue-950/20"
                        : "border-neutral-200 dark:border-neutral-800"
                    )}
                  >
                    <TemplatePreview template={key} className="aspect-video mb-2" />
                    <span className="block text-center text-sm font-medium">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isLoading} className="rounded-xl">
              {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Créer le tableau
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
