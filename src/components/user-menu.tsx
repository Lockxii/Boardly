import { useEffect, useState } from "react";
import { LogOut, Plug, Settings } from "lucide-react";
import { toast } from "sonner";
import { getInitials } from "@/lib/utils";
import { SettingsDialog } from "@/components/settings-dialog";
import { TwitterIntegrationDialog } from "@/components/twitter-integration-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { User } from "@/lib/types";

type UserMenuProps = {
  user?: User | null;
  onSignOut: () => void;
};

export function UserMenu({ user, onSignOut }: UserMenuProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [integrationsOpen, setIntegrationsOpen] = useState(false);
  const label = user?.name || user?.email || "Compte";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const twitter = params.get("twitter");
    if (!twitter) return;
    setIntegrationsOpen(true);
    if (twitter === "connected") toast.success("Twitter connecté");
    if (twitter === "error") toast.error("Connexion Twitter impossible");
    params.delete("twitter");
    const search = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${search ? `?${search}` : ""}`);
  }, []);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 pl-1 pr-3 py-1 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
              {getInitials(label)}
            </span>
            <span className="hidden sm:inline text-sm font-medium text-neutral-700 dark:text-neutral-200 max-w-[120px] truncate">
              {label}
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 rounded-xl">
          <DropdownMenuLabel className="font-normal">
            <p className="font-medium truncate">{user?.name || "Mon compte"}</p>
            <p className="text-xs text-neutral-500 truncate">{user?.email}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="gap-2 cursor-pointer rounded-lg" onClick={() => setSettingsOpen(true)}>
            <Settings className="h-4 w-4" />
            Paramètres
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2 cursor-pointer rounded-lg" onClick={() => setIntegrationsOpen(true)}>
            <Plug className="h-4 w-4" />
            Intégrations
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-2 cursor-pointer rounded-lg text-red-600 focus:text-red-600"
            onClick={onSignOut}
          >
            <LogOut className="h-4 w-4" />
            Se déconnecter
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SettingsDialog user={user} open={settingsOpen} onOpenChange={setSettingsOpen} />
      <TwitterIntegrationDialog open={integrationsOpen} onOpenChange={setIntegrationsOpen} />
    </>
  );
}
