import { useEffect } from "react";
import { X } from "lucide-react";

const SHORTCUTS = [
  { category: "Outils", items: [
    { keys: "V", desc: "Sélection" },
    { keys: "R", desc: "Rectangle" },
    { keys: "E", desc: "Ellipse" },
    { keys: "T", desc: "Texte" },
    { keys: "N", desc: "Note" },
    { keys: "P", desc: "Crayon" },
    { keys: "X", desc: "Gomme" },
  ]},
  { category: "Édition", items: [
    { keys: "Ctrl+Z", desc: "Annuler" },
    { keys: "Ctrl+Shift+Z", desc: "Rétablir" },
    { keys: "Ctrl+D", desc: "Dupliquer" },
    { keys: "Ctrl+C", desc: "Copier" },
    { keys: "Ctrl+V", desc: "Coller (texte, image, lien, éléments)" },
    { keys: "Suppr", desc: "Supprimer" },
    { keys: "Flèches", desc: "Déplacer (Shift = ×10)" },
  ]},
  { category: "Navigation", items: [
    { keys: "Espace+glisser", desc: "Pan" },
    { keys: "Ctrl+=", desc: "Zoom avant" },
    { keys: "Ctrl+-", desc: "Zoom arrière" },
    { keys: "Ctrl+0", desc: "Réinitialiser vue" },
    { keys: "F", desc: "Ajuster la vue" },
    { keys: "G", desc: "Basculer grille" },
    { keys: "M", desc: "Basculer minimap" },
    { keys: "Shift+S", desc: "Snap to grid" },
    { keys: "Shift+P", desc: "Mode présentation" },
    { keys: "Échap / V", desc: "Quitter connecteur / relier" },
  ]},
  { category: "Import", items: [
    { keys: "Ctrl+V", desc: "Coller image / lien / texte" },
    { keys: "Glisser-déposer", desc: "Images ou URLs sur le canvas" },
  ]},
  { category: "Général", items: [
    { keys: "Ctrl+K", desc: "Palette de commandes" },
    { keys: "?", desc: "Ce panneau d'aide" },
    { keys: "Échap", desc: "Désélectionner / Quitter" },
  ]},
];

export function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "?") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-700 w-full max-w-2xl max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-neutral-100 dark:border-neutral-700">
          <h2 className="text-lg font-bold dark:text-white">Raccourcis clavier</h2>
          <button onClick={onClose} className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition">
            <X className="h-5 w-5 text-neutral-500" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)] grid grid-cols-1 md:grid-cols-2 gap-8">
          {SHORTCUTS.map(({ category, items }) => (
            <div key={category}>
              <h3 className="text-xs uppercase font-bold text-neutral-400 mb-3 tracking-wider">{category}</h3>
              <div className="space-y-2">
                {items.map(({ keys, desc }) => (
                  <div key={keys} className="flex items-center justify-between">
                    <span className="text-sm text-neutral-700 dark:text-neutral-300">{desc}</span>
                    <div className="flex gap-1">
                      {keys.split("+").map((k, i) => (
                        <span key={i}>
                          {i > 0 && <span className="text-neutral-300 dark:text-neutral-600 mx-0.5">+</span>}
                          <kbd className="inline-block px-2 py-0.5 text-[11px] font-mono bg-neutral-100 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded text-neutral-600 dark:text-neutral-300 shadow-sm">
                            {k.trim()}
                          </kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
