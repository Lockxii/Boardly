import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Layout, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { label: "Produit", href: "#demo" },
  { label: "Fonctionnalités", href: "#features" },
  { label: "FAQ", href: "#faq" },
] as const;

type LandingNavbarProps = {
  isLoggedIn: boolean;
  ctaTo: string;
};

export function LandingNavbar({ isLoggedIn, ctaTo }: LandingNavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-[#FDFCF8]/90 dark:bg-[#0A0A0A]/90 backdrop-blur-md border-b border-neutral-200/80 dark:border-neutral-800/80 shadow-sm shadow-black/[0.03]"
          : "bg-transparent border-b border-transparent"
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
        {/* Logo */}
        <Link
          to="/"
          className="flex items-center gap-2.5 font-bold text-lg tracking-tight shrink-0"
          onClick={() => setMobileOpen(false)}
        >
          <div className="h-8 w-8 bg-neutral-900 dark:bg-white rounded-lg flex items-center justify-center text-white dark:text-neutral-900">
            <Layout className="h-4 w-4" />
          </div>
          <span>Boardly</span>
        </Link>

        {/* Center nav — desktop */}
        {!isLoggedIn && (
          <nav className="hidden md:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
            {NAV_LINKS.map(({ label, href }) => (
              <a
                key={href}
                href={href}
                className="px-3.5 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white rounded-lg hover:bg-neutral-900/[0.04] dark:hover:bg-white/[0.06] transition-colors"
              >
                {label}
              </a>
            ))}
          </nav>
        )}

        {/* Actions — desktop */}
        <div className="hidden md:flex items-center gap-2.5 shrink-0">
          {isLoggedIn ? (
            <Link
              to="/dashboard"
              className="inline-flex h-9 items-center justify-center rounded-lg bg-neutral-900 dark:bg-white px-4 text-sm font-semibold text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors"
            >
              Tableau de bord
            </Link>
          ) : (
            <>
              <Link
                to="/auth/sign-in"
                className="inline-flex h-9 items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white/70 dark:bg-neutral-900/70 px-4 text-sm font-medium text-neutral-800 dark:text-neutral-200 hover:bg-white dark:hover:bg-neutral-800 transition-colors"
              >
                Se connecter
              </Link>
              <Link
                to={ctaTo}
                className="inline-flex h-9 items-center justify-center rounded-lg bg-neutral-900 dark:bg-white px-4 text-sm font-semibold text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors"
              >
                Essayer gratuitement
              </Link>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white/80 dark:bg-neutral-900/80 text-neutral-700 dark:text-neutral-200"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-neutral-200/80 dark:border-neutral-800/80 bg-[#FDFCF8] dark:bg-[#0A0A0A] px-4 pb-5 pt-3">
          {!isLoggedIn && (
            <nav className="flex flex-col gap-1 mb-4">
              {NAV_LINKS.map(({ label, href }) => (
                <a
                  key={href}
                  href={href}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900"
                  onClick={() => setMobileOpen(false)}
                >
                  {label}
                </a>
              ))}
            </nav>
          )}
          <div className="flex flex-col gap-2">
            {isLoggedIn ? (
              <Link
                to="/dashboard"
                className="inline-flex h-10 items-center justify-center rounded-lg bg-neutral-900 dark:bg-white text-sm font-semibold text-white dark:text-neutral-900"
                onClick={() => setMobileOpen(false)}
              >
                Tableau de bord
              </Link>
            ) : (
              <>
                <Link
                  to="/auth/sign-in"
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-700 text-sm font-medium"
                  onClick={() => setMobileOpen(false)}
                >
                  Se connecter
                </Link>
                <Link
                  to={ctaTo}
                  className="inline-flex h-10 items-center justify-center rounded-lg bg-neutral-900 dark:bg-white text-sm font-semibold text-white dark:text-neutral-900"
                  onClick={() => setMobileOpen(false)}
                >
                  Essayer gratuitement
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
