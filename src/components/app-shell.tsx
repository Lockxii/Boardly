import type { ReactNode } from "react";
import { Moon, Sun } from "lucide-react";
import { BoardlyBrand } from "@/components/boardly-brand";
import { UserMenu } from "@/components/user-menu";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";
import type { User } from "@/lib/types";

type AppShellProps = {
  user?: User | null;
  onSignOut: () => void;
  actions?: ReactNode;
  children: ReactNode;
};

export function AppShell({ user, onSignOut, actions, children }: AppShellProps) {
  const { darkMode, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-[#FDFCF8] dark:bg-[#0A0A0A] text-neutral-900 dark:text-white">
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.35] dark:opacity-[0.12] bg-[radial-gradient(#a3a3a3_1px,transparent_1px)] [background-size:20px_20px]"
        aria-hidden
      />

      <header className="sticky top-0 z-40 border-b border-neutral-200/80 dark:border-neutral-800/80 bg-[#FDFCF8]/90 dark:bg-[#0A0A0A]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <BoardlyBrand to="/dashboard" className="text-lg" />

          <div className="flex items-center gap-2 sm:gap-3">
            {actions}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-lg"
              onClick={toggleTheme}
              title={darkMode ? "Mode clair" : "Mode sombre"}
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <UserMenu user={user} onSignOut={onSignOut} />
          </div>
        </div>
      </header>

      <main className="relative z-10 px-4 sm:px-6 py-8 sm:py-10">{children}</main>
    </div>
  );
}
