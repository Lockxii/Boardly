import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Lock, Moon, Sun, User } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { getInitials } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { User as UserType } from "@/lib/types";

type SettingsTab = "profile" | "security" | "appearance";

type SettingsDialogProps = {
  user?: UserType | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SettingsDialog({ user, open, onOpenChange }: SettingsDialogProps) {
  const queryClient = useQueryClient();
  const { darkMode, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [name, setName] = useState(user?.name || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (open) setName(user?.name || "");
  }, [open, user?.name]);

  const handleSave = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const { error } = await authClient.updateUser({ name });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      setMessage({ type: "success", text: "Profil mis à jour." });
    } catch {
      setMessage({ type: "error", text: "Erreur lors de la mise à jour." });
    }
    setLoading(false);
  };

  const handlePassword = async () => {
    if (!currentPassword || !newPassword) return;
    setLoading(true);
    setMessage(null);
    try {
      const { error } = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: false,
      });
      if (error) throw error;
      setMessage({ type: "success", text: "Mot de passe modifié." });
      setCurrentPassword("");
      setNewPassword("");
    } catch {
      setMessage({ type: "error", text: "Erreur. Vérifiez votre mot de passe actuel." });
    }
    setLoading(false);
  };

  const tabs: { id: SettingsTab; label: string; icon: typeof User }[] = [
    { id: "profile", label: "Profil", icon: User },
    { id: "security", label: "Sécurité", icon: Lock },
    { id: "appearance", label: "Apparence", icon: darkMode ? Moon : Sun },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] p-0 overflow-hidden rounded-3xl">
        <div className="flex min-h-[420px] flex-col sm:flex-row">
          <aside className="border-b sm:border-b-0 sm:border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 p-4 sm:w-52">
            <DialogHeader className="mb-4 px-2 text-left">
              <DialogTitle className="text-lg">Paramètres</DialogTitle>
              <DialogDescription className="text-xs">Compte et préférences</DialogDescription>
            </DialogHeader>
            <nav className="flex sm:flex-col gap-1 overflow-x-auto">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setActiveTab(id);
                    setMessage(null);
                  }}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap",
                    activeTab === id
                      ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-sm"
                      : "text-neutral-600 dark:text-neutral-400 hover:bg-white/60 dark:hover:bg-neutral-900/60"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </nav>
          </aside>

          <div className="flex-1 p-6 overflow-y-auto">
            {message && (
              <div
                className={cn(
                  "mb-4 rounded-xl p-3 text-sm",
                  message.type === "success"
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                )}
              >
                {message.text}
              </div>
            )}

            {activeTab === "profile" && (
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-lg font-bold text-white">
                    {getInitials(user?.name || user?.email || "?")}
                  </div>
                  <div>
                    <p className="font-semibold text-neutral-900 dark:text-white">{user?.name || "Utilisateur"}</p>
                    <p className="text-sm text-neutral-500">{user?.email}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="settings-name">Nom affiché</Label>
                  <Input
                    id="settings-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={user?.email || ""} disabled className="rounded-xl bg-neutral-50 dark:bg-neutral-900" />
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleSave} disabled={loading} className="rounded-xl">
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Enregistrer
                  </Button>
                </div>
              </div>
            )}

            {activeTab === "security" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Mot de passe actuel</Label>
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nouveau mot de passe</Label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={handlePassword}
                    disabled={loading || !currentPassword || !newPassword}
                    className="rounded-xl"
                  >
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Mettre à jour
                  </Button>
                </div>
              </div>
            )}

            {activeTab === "appearance" && (
              <div className="space-y-4">
                <p className="text-sm text-neutral-500">
                  Choisissez l&apos;apparence de Boardly sur le dashboard et dans l&apos;éditeur.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => darkMode && toggleTheme()}
                    className={cn(
                      "rounded-2xl border-2 p-4 text-left transition-all",
                      !darkMode
                        ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/20"
                        : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300"
                    )}
                  >
                    <Sun className="mb-2 h-5 w-5" />
                    <p className="font-medium">Clair</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => !darkMode && toggleTheme()}
                    className={cn(
                      "rounded-2xl border-2 p-4 text-left transition-all",
                      darkMode
                        ? "border-blue-600 bg-blue-950/30"
                        : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300"
                    )}
                  >
                    <Moon className="mb-2 h-5 w-5" />
                    <p className="font-medium">Sombre</p>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
