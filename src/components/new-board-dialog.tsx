import { useState } from "react";
import { Loader2, Plus, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { TemplatePreview } from "@/components/template-preview";
import { BOARD_TEMPLATES } from "@/lib/template-styles";
import { cn } from "@/lib/utils";

const TEMPLATES = Object.entries(BOARD_TEMPLATES).map(([key, { label }]) => ({
  key,
  label,
}));

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

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setTitle("");
      setSelectedTemplate("blank");
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Trigger asChild>
        <Button
          variant={triggerVariant}
          className={cn(
            "transition-transform active:scale-[0.97]",
            triggerVariant === "default" &&
              "rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 shadow-lg shadow-black/10"
          )}
        >
          <Plus className="h-4 w-4 mr-2" />
          {triggerLabel}
        </Button>
      </DialogPrimitive.Trigger>

      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            </DialogPrimitive.Overlay>

            <DialogPrimitive.Content asChild forceMount>
              <motion.div
                className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-[640px] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-neutral-200/80 dark:border-neutral-800 bg-[#FDFCF8] dark:bg-neutral-950 shadow-2xl shadow-black/15 overflow-hidden outline-none"
                initial={{ opacity: 0, y: 24, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.98 }}
                transition={{ type: "spring", damping: 26, stiffness: 320 }}
              >
                <div className="border-b border-neutral-200/80 dark:border-neutral-800 bg-white/60 dark:bg-neutral-900/40 px-6 py-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-600/25">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <DialogPrimitive.Title className="text-lg font-semibold tracking-tight">
                        Créer un tableau
                      </DialogPrimitive.Title>
                      <DialogPrimitive.Description className="text-sm text-neutral-500 mt-1">
                        Donnez-lui un nom et choisissez un point de départ.
                      </DialogPrimitive.Description>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="board-title">Titre</Label>
                    <Input
                      id="board-title"
                      placeholder="Mon super projet"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="rounded-xl bg-white dark:bg-neutral-900"
                      autoFocus
                    />
                  </div>

                  <div className="space-y-3">
                    <Label>Modèle</Label>
                    <div className="grid grid-cols-3 gap-3">
                      {TEMPLATES.map(({ key, label }, index) => {
                        const selected = selectedTemplate === key;
                        return (
                          <motion.button
                            key={key}
                            type="button"
                            onClick={() => setSelectedTemplate(key)}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.05 + index * 0.05, duration: 0.25 }}
                            whileHover={{ y: -2 }}
                            whileTap={{ scale: 0.98 }}
                            className={cn(
                              "rounded-2xl border-2 p-2 text-left transition-colors",
                              selected
                                ? "border-blue-600 bg-blue-50/70 dark:bg-blue-950/30 ring-2 ring-blue-600/20"
                                : "border-neutral-200 dark:border-neutral-800 hover:border-blue-300 dark:hover:border-blue-800"
                            )}
                          >
                            <TemplatePreview template={key} className="aspect-video mb-2" />
                            <span className="block text-center text-sm font-medium">{label}</span>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => setOpen(false)}
                    >
                      Annuler
                    </Button>
                    <Button type="submit" disabled={isLoading} className="rounded-xl min-w-[140px]">
                      {isLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Création…
                        </>
                      ) : (
                        "Créer le tableau"
                      )}
                    </Button>
                  </div>
                </form>

                <DialogPrimitive.Close className="absolute right-4 top-4 rounded-lg p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                  <span className="sr-only">Fermer</span>
                  <Plus className="h-4 w-4 rotate-45" />
                </DialogPrimitive.Close>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
