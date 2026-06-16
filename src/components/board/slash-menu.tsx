import { useEffect, useMemo, useRef, useState } from "react";
import { StickyNote, Type, Frame as FrameIcon, Square, Circle, Columns3, MessageCircle } from "lucide-react";
import type { LayerType } from "@/lib/types";

type InsertCommand = {
  id: string;
  label: string;
  keywords: string;
  icon: typeof StickyNote;
  type: LayerType;
  width?: number;
  height?: number;
};

const COMMANDS: InsertCommand[] = [
  { id: "note", label: "Note", keywords: "note sticky post-it", icon: StickyNote, type: "Note", width: 200, height: 200 },
  { id: "text", label: "Texte", keywords: "texte titre", icon: Type, type: "Text", width: 220, height: 48 },
  { id: "frame", label: "Cadre", keywords: "cadre section frame", icon: FrameIcon, type: "Frame", width: 400, height: 300 },
  { id: "column", label: "Colonne", keywords: "colonne column liste", icon: Columns3, type: "Column", width: 300, height: 500 },
  { id: "rectangle", label: "Rectangle", keywords: "rectangle carré forme", icon: Square, type: "Rectangle", width: 160, height: 120 },
  { id: "ellipse", label: "Ellipse", keywords: "ellipse cercle rond", icon: Circle, type: "Ellipse", width: 140, height: 140 },
];

type Row = { kind: "chat"; text: string } | { kind: "insert"; cmd: InsertCommand };

export function SlashMenu({
  screen,
  canHandleChat,
  onInsert,
  onChat,
  onClose,
}: {
  screen: { x: number; y: number };
  canHandleChat: boolean;
  onInsert: (type: LayerType, width?: number, height?: number) => void;
  onChat: (text: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const rows = useMemo<Row[]>(() => {
    const q = query.trim().toLowerCase();
    const matches = COMMANDS.filter((c) => !q || c.label.toLowerCase().includes(q) || c.keywords.includes(q));
    const chatRow: Row[] = canHandleChat && query.trim() ? [{ kind: "chat", text: query.trim() }] : [];
    return [...chatRow, ...matches.map((cmd) => ({ kind: "insert", cmd }) as Row)];
  }, [query, canHandleChat]);

  useEffect(() => {
    if (index >= rows.length) setIndex(Math.max(0, rows.length - 1));
  }, [rows.length, index]);

  const run = (row: Row | undefined) => {
    if (!row) {
      if (canHandleChat && query.trim()) onChat(query.trim());
      onClose();
      return;
    }
    if (row.kind === "chat") onChat(row.text);
    else onInsert(row.cmd.type, row.cmd.width, row.cmd.height);
    onClose();
  };

  return (
    <div
      className="pointer-events-auto fixed z-[47] w-60 -translate-y-2 overflow-hidden rounded-xl border border-neutral-200 bg-white/95 shadow-xl backdrop-blur dark:border-neutral-700 dark:bg-neutral-900/95"
      style={{ left: screen.x, top: screen.y }}
    >
      <input
        ref={inputRef}
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setIndex((i) => Math.min(rows.length - 1, i + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setIndex((i) => Math.max(0, i - 1));
          } else if (e.key === "Enter") {
            e.preventDefault();
            run(rows[index]);
          } else if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
        }}
        onBlur={onClose}
        placeholder={canHandleChat ? "Insérer… ou dire qqch" : "Insérer un élément…"}
        className="w-full border-b border-neutral-100 bg-transparent px-3 py-2 text-xs outline-none dark:border-neutral-800"
      />
      <div className="max-h-56 overflow-y-auto py-1">
        {rows.length === 0 && <div className="px-3 py-2 text-xs text-neutral-400">Aucun résultat</div>}
        {rows.map((row, i) => {
          const active = i === index;
          if (row.kind === "chat") {
            return (
              <button
                key="chat"
                type="button"
                onMouseEnter={() => setIndex(i)}
                onClick={() => run(row)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs ${active ? "bg-blue-50 dark:bg-blue-950/40" : ""}`}
              >
                <MessageCircle className="h-3.5 w-3.5 text-blue-500" />
                <span className="truncate">Dire «{row.text}»</span>
              </button>
            );
          }
          const Icon = row.cmd.icon;
          return (
            <button
              key={row.cmd.id}
              type="button"
              onMouseEnter={() => setIndex(i)}
              onClick={() => run(row)}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs ${active ? "bg-blue-50 dark:bg-blue-950/40" : ""}`}
            >
              <Icon className="h-3.5 w-3.5 text-neutral-500" />
              {row.cmd.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
