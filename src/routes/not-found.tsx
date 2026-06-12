import { Link } from "@tanstack/react-router";
import { MoveLeft, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <main className="h-full w-full min-h-screen bg-neutral-100 dark:bg-neutral-950 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="relative">
          <div className="absolute inset-0 blur-3xl bg-blue-500/10 dark:bg-blue-500/5 rounded-full" />
          <HelpCircle className="h-24 w-24 text-blue-500 mx-auto relative animate-bounce" />
        </div>
        <div className="space-y-3 relative">
          <h1 className="text-6xl font-black text-neutral-900 dark:text-white tracking-tighter">404</h1>
          <h2 className="text-2xl font-bold text-neutral-800 dark:text-neutral-200">Oups, ce tableau est vide...</h2>
          <p className="text-neutral-500 dark:text-neutral-400">
            La page que vous recherchez n'existe pas ou a été déplacée.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 relative">
          <Link to="/dashboard">
            <Button size="lg" className="w-full sm:w-auto gap-2 shadow-lg">
              <MoveLeft className="h-4 w-4" />
              Retour au Dashboard
            </Button>
          </Link>
          <Link to="/">
            <Button variant="outline" size="lg" className="w-full sm:w-auto bg-white/50 dark:bg-black/20 backdrop-blur-sm">
              Aller à l'accueil
            </Button>
          </Link>
        </div>
        <div className="pt-12 text-[10px] uppercase tracking-widest text-neutral-400 font-bold">
          Boardly — Créativité sans limites
        </div>
      </div>
    </main>
  );
}
