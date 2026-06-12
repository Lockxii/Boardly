import { useState, useEffect, useRef, useMemo } from "react";
import { useCanvasStore } from "@/store/canvas-store";
import { useNavigate } from "@tanstack/react-router";
import {
  MousePointer2, Square, Circle, Type, StickyNote, Pencil, Eraser,
  Layers, Grid3X3, Map, Keyboard, Home, Hand, Minus, Frame, Link2, Camera,
  Plus, MoveRight, Diamond, Star, Triangle as TriangleIcon, Search
} from "lucide-react";

interface Command {
  id: string;
  label: string;
  shortcut?: string;
  icon: any;
  action: () => void;
  category: string;
}

export function CommandPalette() {
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { setCanvasState, toggleGrid, toggleMinimap, setShowCommandPalette, setCamera, createVersion, setConnectFromId } = useCanvasStore();
  const navigate = useNavigate();

  const commands: Command[] = useMemo(() => [
    // Tools
    { id: "select", label: "Outil Sélection", shortcut: "V", icon: MousePointer2, action: () => { setCanvasState({ mode: "none" }); setConnectFromId(null); setShowCommandPalette(false); }, category: "Outils" },
    { id: "hand", label: "Main (pan)", shortcut: "H", icon: Hand, action: () => { setCanvasState({ mode: "panning" }); setConnectFromId(null); setShowCommandPalette(false); }, category: "Outils" },
    { id: "line", label: "Ligne", shortcut: "L", icon: Minus, action: () => { setCanvasState({ mode: "inserting", layerType: "Line" }); setConnectFromId(null); setShowCommandPalette(false); }, category: "Outils" },
    { id: "frame", label: "Cadre", shortcut: "Shift+F", icon: Frame, action: () => { setCanvasState({ mode: "inserting", layerType: "Frame" }); setConnectFromId(null); setShowCommandPalette(false); }, category: "Outils" },
    { id: "connect", label: "Connecteur", icon: Link2, action: () => { const sel = useCanvasStore.getState().selection; setConnectFromId(sel[0] ?? null); setShowCommandPalette(false); }, category: "Outils" },
    { id: "snapshot", label: "Créer un instantané", icon: Camera, action: () => { createVersion(); setShowCommandPalette(false); }, category: "Outils" },
    { id: "rect", label: "Rectangle", shortcut: "R", icon: Square, action: () => { setCanvasState({ mode: "inserting", layerType: "Rectangle" }); setShowCommandPalette(false); }, category: "Outils" },
    { id: "ellipse", label: "Ellipse", shortcut: "E", icon: Circle, action: () => { setCanvasState({ mode: "inserting", layerType: "Ellipse" }); setShowCommandPalette(false); }, category: "Outils" },
    { id: "text", label: "Texte", shortcut: "T", icon: Type, action: () => { setCanvasState({ mode: "inserting", layerType: "Text" }); setShowCommandPalette(false); }, category: "Outils" },
    { id: "note", label: "Note", shortcut: "N", icon: StickyNote, action: () => { setCanvasState({ mode: "inserting", layerType: "Note" }); setShowCommandPalette(false); }, category: "Outils" },
    { id: "pencil", label: "Crayon", shortcut: "P", icon: Pencil, action: () => { setCanvasState({ mode: "pencil" }); useCanvasStore.getState().setPencilTool("draw"); setShowCommandPalette(false); }, category: "Outils" },
    { id: "eraser", label: "Gomme", shortcut: "X", icon: Eraser, action: () => { setCanvasState({ mode: "pencil" }); useCanvasStore.getState().setPencilTool("erase"); setShowCommandPalette(false); }, category: "Outils" },
    { id: "triangle", label: "Triangle", icon: TriangleIcon, action: () => { setCanvasState({ mode: "inserting", layerType: "Triangle" }); setShowCommandPalette(false); }, category: "Outils" },
    { id: "arrow", label: "Flèche", icon: MoveRight, action: () => { setCanvasState({ mode: "inserting", layerType: "Arrow" }); setShowCommandPalette(false); }, category: "Outils" },
    { id: "diamond", label: "Losange", icon: Diamond, action: () => { setCanvasState({ mode: "inserting", layerType: "Diamond" }); setShowCommandPalette(false); }, category: "Outils" },
    { id: "star", label: "Étoile", icon: Star, action: () => { setCanvasState({ mode: "inserting", layerType: "Star" }); setShowCommandPalette(false); }, category: "Outils" },
    // View
    { id: "grid", label: "Basculer Grille", shortcut: "G", icon: Grid3X3, action: () => { toggleGrid(); setShowCommandPalette(false); }, category: "Vue" },
    { id: "minimap", label: "Basculer Minimap", shortcut: "M", icon: Map, action: () => { toggleMinimap(); setShowCommandPalette(false); }, category: "Vue" },
    { id: "resetzoom", label: "Réinitialiser Zoom", shortcut: "Ctrl+0", icon: Search, action: () => { setCamera({ x: 0, y: 0, zoom: 1 }); setShowCommandPalette(false); }, category: "Vue" },
    // Navigation
    { id: "home", label: "Accueil", icon: Home, action: () => { navigate({ to: "/" }); setShowCommandPalette(false); }, category: "Navigation" },
    { id: "dashboard", label: "Dashboard", icon: Home, action: () => { navigate({ to: "/dashboard" }); setShowCommandPalette(false); }, category: "Navigation" },
    { id: "shortcuts", label: "Voir les raccourcis", icon: Keyboard, action: () => { setShowCommandPalette(false); alert(HELP_TEXT); }, category: "Aide" },
  ], [setCanvasState, toggleGrid, toggleMinimap, setShowCommandPalette, setCamera, navigate, createVersion, setConnectFromId]);

  const filtered = useMemo(() => {
    if (!query) return commands;
    const q = query.toLowerCase();
    return commands.filter((c) => c.label.toLowerCase().includes(q) || c.category.toLowerCase().includes(q));
  }, [commands, query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  useEffect(() => {
    const el = listRef.current?.children[selectedIdx] as HTMLElement;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIdx]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); filtered[selectedIdx]?.action(); }
    else if (e.key === "Escape") { setShowCommandPalette(false); }
  };

  // Group by category
  const grouped = useMemo(() => {
    const groups: Record<string, Command[]> = {};
    filtered.forEach((cmd) => {
      if (!groups[cmd.category]) groups[cmd.category] = [];
      groups[cmd.category].push(cmd);
    });
    return groups;
  }, [filtered]);

  let flatIdx = 0;

  return (
    <div className="cmd-overlay" onClick={() => setShowCommandPalette(false)}>
      <div className="w-full max-w-lg bg-white dark:bg-neutral-800 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-700 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 p-4 border-b border-neutral-100 dark:border-neutral-700">
          <Search className="h-5 w-5 text-neutral-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Rechercher une action..."
            className="flex-1 text-sm bg-transparent outline-none dark:text-white placeholder:text-neutral-400"
          />
          <kbd className="text-[10px] bg-neutral-100 dark:bg-neutral-700 px-1.5 py-0.5 rounded text-neutral-500">ESC</kbd>
        </div>
        <div ref={listRef} className="max-h-80 overflow-y-auto py-2">
          {filtered.length === 0 && (
            <div className="text-center text-sm text-neutral-500 py-8">Aucun résultat</div>
          )}
          {Object.entries(grouped).map(([category, cmds]) => (
            <div key={category}>
              <div className="px-4 py-1 text-[10px] uppercase font-bold text-neutral-400">{category}</div>
              {cmds.map((cmd) => {
                const idx = flatIdx++;
                const Icon = cmd.icon;
                return (
                  <button
                    key={cmd.id}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors ${idx === selectedIdx ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" : "hover:bg-neutral-50 dark:hover:bg-neutral-700/50 dark:text-neutral-200"}`}
                    onClick={() => cmd.action()}
                    onMouseEnter={() => setSelectedIdx(idx)}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 text-left">{cmd.label}</span>
                    {cmd.shortcut && (
                      <kbd className="text-[10px] bg-neutral-100 dark:bg-neutral-700 px-1.5 py-0.5 rounded text-neutral-500">{cmd.shortcut}</kbd>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const HELP_TEXT = `Raccourcis clavier Boardly:

V — Sélection
H — Main (pan)
L — Ligne
Shift+F — Cadre
R — Rectangle
E — Ellipse
T — Texte
N — Note
P — Crayon
X — Gomme
G — Basculer grille
M — Basculer minimap
F — Ajuster la vue
Ctrl+K — Palette de commandes
Ctrl+Z — Annuler
Ctrl+Shift+Z — Rétablir
Ctrl+D — Dupliquer
Suppr — Supprimer
Ctrl+=/— — Zoom avant/arrière
Ctrl+0 — Réinitialiser vue
Flèches — Déplacer (Shift = x10)
Espace+glisser — Pan`;
