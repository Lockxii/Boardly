import { useState, useRef, useEffect, useCallback } from "react";
import {
  X,
  Send,
  Loader2,
  Wand2,
  Link2,
  MousePointer2,
  Plus,
  ChevronDown,
  GripHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useCanvasStore } from "@/store/canvas-store";
import { buildBoardSummary, buildLinkedLayersSummary } from "@/lib/board-context";
import { sendFredMessage, fetchFredStatus, type FredChatMessage } from "@/lib/fred-ai";
import { applyFredActions } from "@/lib/fred-actions";
import { buildVisionFromLinked, countLinkedImages } from "@/lib/fred-vision";
import {
  createFredSession,
  loadActiveSessionId,
  loadFredPanelLayout,
  loadFredSessions,
  saveActiveSessionId,
  saveFredPanelLayout,
  saveFredSessions,
  sessionTitleFromMessage,
  type FredChatSession,
  type FredPanelLayout,
} from "@/lib/fred-chats";
import { cn } from "@/lib/utils";

const MIN_WIDTH = 300;
const MIN_HEIGHT = 360;
const DEFAULT_LAYOUT: FredPanelLayout = { x: 16, y: 64, width: 384, height: 520 };

function FredAvatar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-sm font-bold text-white shadow-md shadow-blue-600/25",
        className
      )}
    >
      F
    </div>
  );
}

type FredPanelProps = {
  onClose: () => void;
  boardTitle?: string;
  boardTemplate?: string;
  boardId?: string;
};

export function FredPanel({ onClose, boardTitle, boardTemplate, boardId = "" }: FredPanelProps) {
  const layers = useCanvasStore((s) => s.layers);
  const layerIds = useCanvasStore((s) => s.layerIds);
  const selection = useCanvasStore((s) => s.selection);
  const connections = useCanvasStore((s) => s.connections);
  const setCamera = useCanvasStore((s) => s.setCamera);

  const [sessions, setSessions] = useState<FredChatSession[]>(() => loadFredSessions(boardId));
  const [activeId, setActiveId] = useState(() => {
    const stored = loadActiveSessionId(boardId);
    const loaded = loadFredSessions(boardId);
    return stored && loaded.some((s) => s.id === stored) ? stored : loaded[0]?.id;
  });
  const activeSession = sessions.find((s) => s.id === activeId) ?? sessions[0];

  const [input, setInput] = useState("");
  const [linkedIds, setLinkedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [preparingVision, setPreparingVision] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [layout, setLayout] = useState<FredPanelLayout>(
    () => loadFredPanelLayout(boardId) ?? DEFAULT_LAYOUT
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number } | null>(null);

  const messages = (activeSession?.messages ?? []) as FredChatMessage[];

  const persistSessions = useCallback(
    (next: FredChatSession[]) => {
      setSessions(next);
      saveFredSessions(boardId, next);
    },
    [boardId]
  );

  const updateActiveSession = useCallback(
    (updater: (session: FredChatSession) => FredChatSession) => {
      persistSessions(
        sessions.map((s) => (s.id === activeId ? updater(s) : s))
      );
    },
    [activeId, persistSessions, sessions]
  );

  useEffect(() => {
    fetchFredStatus()
      .then((s) => setConfigured(s.configured))
      .catch(() => setConfigured(false));
  }, []);

  useEffect(() => {
    const loaded = loadFredSessions(boardId);
    setSessions(loaded);
    const stored = loadActiveSessionId(boardId);
    setActiveId(stored && loaded.some((s) => s.id === stored) ? stored : loaded[0]?.id);
    setLayout(loadFredPanelLayout(boardId) ?? DEFAULT_LAYOUT);
  }, [boardId]);

  useEffect(() => {
    saveActiveSessionId(boardId, activeId);
  }, [activeId, boardId]);

  useEffect(() => {
    saveFredPanelLayout(boardId, layout);
  }, [boardId, layout]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, loading, preparingVision, activeId]);

  const getBoardContext = (linked: string[]) => {
    const summary = buildBoardSummary({
      title: boardTitle,
      template: boardTemplate,
      layers,
      layerIds,
      selection: linked.length ? linked : selection,
      connections,
    });
    const linkedSummary = buildLinkedLayersSummary(linked, layers);
    return {
      title: boardTitle,
      template: boardTemplate,
      ...summary,
      linkedSummary: linkedSummary || undefined,
    };
  };

  const handleLinkSelection = () => {
    if (!selection.length) {
      toast.error("Sélectionnez d'abord des éléments.");
      return;
    }
    setLinkedIds([...selection]);
    toast.success(`${selection.length} élément${selection.length > 1 ? "s" : ""} lié${selection.length > 1 ? "s" : ""}`);
  };

  const zoomToLayers = (ids: string[]) => {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity,
      found = false;
    ids.forEach((id) => {
      const layer = layers[id];
      if (layer) {
        found = true;
        minX = Math.min(minX, layer.x);
        minY = Math.min(minY, layer.y);
        maxX = Math.max(maxX, layer.x + layer.width);
        maxY = Math.max(maxY, layer.y + layer.height);
      }
    });
    if (!found) return;
    const width = maxX - minX;
    const height = maxY - minY;
    const centerX = minX + width / 2;
    const centerY = minY + height / 2;
    const padding = 100;
    const zoom = Math.min(
      (window.innerWidth - layout.width - 80) / (width + padding),
      (window.innerHeight - 100) / (height + padding),
      2
    );
    setCamera({
      x: window.innerWidth / 2 - centerX * zoom,
      y: window.innerHeight / 2 - centerY * zoom,
      zoom,
    });
  };

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    const hasLinked = linkedIds.length > 0;
    if ((!trimmed && !hasLinked) || loading) return;
    if (configured === false) {
      toast.error("Fred AI n'est pas configuré sur le serveur.");
      return;
    }

    const userMsg: FredChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed || "(Éléments liés)",
      linkedLayerIds: hasLinked ? [...linkedIds] : undefined,
    };

    updateActiveSession((session) => {
      const isFirstUser =
        session.messages.filter((m) => m.role === "user").length === 0;
      return {
        ...session,
        title: isFirstUser && trimmed ? sessionTitleFromMessage(trimmed) : session.title,
        updatedAt: Date.now(),
        messages: [...session.messages, userMsg],
      };
    });

    const currentLinked = [...linkedIds];
    setInput("");
    setLinkedIds([]);
    setLoading(true);

    try {
      setPreparingVision(true);
      const { assets, skipped } = await buildVisionFromLinked({
        linkedIds: currentLinked,
        layers,
      });
      setPreparingVision(false);

      if (skipped > 0) {
        toast.message(`${skipped} image(s) liée(s) ignorée(s) (illisible ou trop lourde)`);
      }

      const history = [...messages, userMsg]
        .filter((m) => m.id !== "welcome" && !m.pending)
        .slice(-8)
        .map((m) => ({ role: m.role, content: m.content }));

      const response = await sendFredMessage({
        message: trimmed || "Analyse les éléments liés et réponds en fonction du contexte.",
        history: history.slice(0, -1),
        boardContext: getBoardContext(currentLinked),
        boardId,
        linkedLayerIds: currentLinked.length ? currentLinked : undefined,
        visionAssets: assets.length ? assets : undefined,
      });

      updateActiveSession((session) => ({
        ...session,
        updatedAt: Date.now(),
        messages: [
          ...session.messages,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: response.reply,
            actions: response.actions?.length ? response.actions : undefined,
            meta: response.meta,
          },
        ],
      }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Fred n'a pas pu répondre");
    } finally {
      setLoading(false);
      setPreparingVision(false);
    }
  };

  const handleApplyActions = (msg: FredChatMessage) => {
    if (!msg.actions?.length) return;
    applyFredActions(msg.actions);
    updateActiveSession((session) => ({
      ...session,
      messages: session.messages.map((m) =>
        m.id === msg.id ? { ...m, actions: undefined } : m
      ),
    }));
  };

  const handleNewChat = () => {
    const session = createFredSession();
    persistSessions([session, ...sessions]);
    setActiveId(session.id);
    setLinkedIds([]);
    setInput("");
  };

  const handleSelectChat = (id: string) => {
    setActiveId(id);
    setLinkedIds([]);
    setInput("");
  };

  const onHeaderPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: layout.x, origY: layout.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onHeaderPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    setLayout((l) => ({
      ...l,
      x: Math.max(8, Math.min(window.innerWidth - l.width - 8, drag.origX + dx)),
      y: Math.max(8, Math.min(window.innerHeight - 120, drag.origY + dy)),
    }));
  };

  const onHeaderPointerUp = (e: React.PointerEvent) => {
    dragRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* pointer already released */
    }
  };

  const onResizePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origW: layout.width,
      origH: layout.height,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onResizePointerMove = (e: React.PointerEvent) => {
    const resize = resizeRef.current;
    if (!resize) return;
    const dx = e.clientX - resize.startX;
    const dy = e.clientY - resize.startY;
    setLayout((l) => ({
      ...l,
      width: Math.max(MIN_WIDTH, Math.min(window.innerWidth - l.x - 8, resize.origW + dx)),
      height: Math.max(MIN_HEIGHT, Math.min(window.innerHeight - l.y - 8, resize.origH + dy)),
    }));
  };

  const onResizePointerUp = (e: React.PointerEvent) => {
    resizeRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* pointer already released */
    }
  };

  const linkedImageCount = countLinkedImages(linkedIds, layers);

  return (
    <div
      className="pointer-events-auto fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-neutral-200/80 bg-[#FDFCF8]/95 shadow-2xl shadow-black/10 backdrop-blur-md dark:border-neutral-700/80 dark:bg-neutral-950/95"
      style={{ left: layout.x, top: layout.y, width: layout.width, height: layout.height }}
    >
      <div
        className="flex cursor-grab items-center justify-between border-b border-neutral-200/80 px-3 py-2.5 active:cursor-grabbing dark:border-neutral-800"
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={onHeaderPointerUp}
        onPointerCancel={onHeaderPointerUp}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <GripHorizontal className="h-4 w-4 shrink-0 text-neutral-400" />
          <FredAvatar className="h-7 w-7 text-xs" />
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold tracking-tight">Fred AI</h3>
            <p className="truncate text-[10px] text-neutral-500">{activeSession?.title ?? "Chat"}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5" onPointerDown={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" title="Historique">
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-64 w-56 overflow-y-auto">
              {sessions.map((s) => (
                <DropdownMenuItem
                  key={s.id}
                  className={cn("cursor-pointer truncate", s.id === activeId && "bg-neutral-100 dark:bg-neutral-800")}
                  onClick={() => handleSelectChat(s.id)}
                >
                  {s.title}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={handleNewChat} title="Nouveau chat">
            <Plus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {configured === false && (
        <div className="border-b border-amber-200/80 bg-amber-50 px-4 py-2 text-[11px] text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          Clé API manquante (<code className="text-[10px]">GOOGLE_AI_API_KEY</code>).
        </div>
      )}

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          return (
            <div key={msg.id} className={cn("flex gap-2", isUser ? "flex-row-reverse" : "flex-row")}>
              {!isUser && <FredAvatar className="mt-0.5 h-7 w-7 shrink-0 text-xs" />}
              <div className={cn("max-w-[88%] space-y-2", isUser && "items-end")}>
                {msg.linkedLayerIds && msg.linkedLayerIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => zoomToLayers(msg.linkedLayerIds!)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium",
                      isUser
                        ? "bg-neutral-800 text-neutral-200 dark:bg-neutral-200 dark:text-neutral-800"
                        : "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                    )}
                  >
                    <MousePointer2 className="h-3 w-3" />
                    {msg.linkedLayerIds.length} élément{msg.linkedLayerIds.length > 1 ? "s" : ""} lié{msg.linkedLayerIds.length > 1 ? "s" : ""}
                  </button>
                )}
                <div
                  className={cn(
                    "rounded-2xl px-3 py-2 text-sm leading-relaxed",
                    isUser
                      ? "rounded-tr-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                      : "rounded-tl-md bg-white text-neutral-800 shadow-sm ring-1 ring-neutral-200/80 dark:bg-neutral-900 dark:text-neutral-100 dark:ring-neutral-800"
                  )}
                >
                  <FredMessageContent content={msg.content} />
                </div>
                {msg.meta?.visionUsed ? (
                  <p className="text-[10px] text-neutral-400">
                    {msg.meta.visionUsed} image{msg.meta.visionUsed > 1 ? "s" : ""} analysée{msg.meta.visionUsed > 1 ? "s" : ""}
                  </p>
                ) : null}
                {msg.actions && msg.actions.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-full border-blue-200 bg-blue-50 text-xs text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                    onClick={() => handleApplyActions(msg)}
                  >
                    <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                    Ajouter au canvas
                  </Button>
                )}
              </div>
            </div>
          );
        })}
        {(loading || preparingVision) && (
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            {preparingVision ? "Préparation des images liées…" : "Fred réfléchit…"}
          </div>
        )}
      </div>

      {linkedIds.length > 0 && (
        <div className="border-t border-neutral-100 bg-neutral-50/80 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900/50">
          <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-2 py-1.5 dark:bg-blue-950/30">
            <Link2 className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-blue-700 dark:text-blue-300">
              {linkedIds.length} élément{linkedIds.length > 1 ? "s" : ""} lié{linkedIds.length > 1 ? "s" : ""}
              {linkedImageCount > 0 && ` · ${linkedImageCount} image${linkedImageCount > 1 ? "s" : ""}`}
            </span>
            <button
              type="button"
              onClick={() => setLinkedIds([])}
              className="rounded p-0.5 hover:bg-blue-100 dark:hover:bg-blue-900/50"
            >
              <X className="h-3 w-3 text-blue-600 dark:text-blue-400" />
            </button>
          </div>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void sendMessage(input);
        }}
        className="flex items-center gap-1 border-t border-neutral-200/80 p-2.5 dark:border-neutral-800"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "h-9 w-9 shrink-0",
            linkedIds.length > 0 ? "text-blue-600 bg-blue-50 dark:bg-blue-950/30" : "text-neutral-500"
          )}
          onClick={handleLinkSelection}
          title="Lier la sélection"
        >
          <Link2 className="h-4 w-4" />
        </Button>
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Demande à Fred…"
          className="h-9 min-w-0 flex-1 rounded-xl border-neutral-200 bg-white text-sm dark:border-neutral-700 dark:bg-neutral-900"
          disabled={loading}
        />
        <Button
          type="submit"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-xl"
          disabled={(!input.trim() && linkedIds.length === 0) || loading}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>

      <div
        className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize"
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={onResizePointerUp}
        onPointerCancel={onResizePointerUp}
        aria-hidden
      >
        <svg viewBox="0 0 16 16" className="h-full w-full text-neutral-300 dark:text-neutral-600">
          <path d="M14 14L8 14M14 14L14 8M14 10L10 14" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      </div>
    </div>
  );
}

function FredMessageContent({ content }: { content: string }) {
  const parts = content.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span className="whitespace-pre-wrap">
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i}>{part.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}
