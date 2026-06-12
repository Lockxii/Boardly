import { useState, useRef, useEffect } from "react";
import { X, Send, Loader2, Sparkles, Wand2, Lightbulb, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useCanvasStore } from "@/store/canvas-store";
import { buildBoardSummary } from "@/lib/board-context";
import { sendFredMessage, fetchFredStatus, type FredChatMessage } from "@/lib/fred-ai";
import { applyFredActions } from "@/lib/fred-actions";
import { cn } from "@/lib/utils";

const QUICK_PROMPTS = [
  { label: "Résumer", icon: FileText, prompt: "Résume ce tableau en 3 points clés." },
  { label: "Brainstorm", icon: Lightbulb, prompt: "Propose 5 idées créatives liées à ce board." },
  { label: "Post-its", icon: Wand2, prompt: "Ajoute 4 post-its avec des angles différents à explorer." },
] as const;

function FredAvatar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-sm font-bold text-white shadow-md shadow-blue-600/25",
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

export function FredPanel({ onClose, boardTitle, boardTemplate, boardId }: FredPanelProps) {
  const layers = useCanvasStore((s) => s.layers);
  const layerIds = useCanvasStore((s) => s.layerIds);
  const selection = useCanvasStore((s) => s.selection);
  const connections = useCanvasStore((s) => s.connections);

  const [messages, setMessages] = useState<FredChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Salut ! Je suis **Fred**, ton assistant sur Boardly. Je peux résumer ton board, brainstormer ou poser des post-its directement sur le canvas.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchFredStatus()
      .then((s) => setConfigured(s.configured))
      .catch(() => setConfigured(false));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const getBoardContext = () => {
    const summary = buildBoardSummary({
      title: boardTitle,
      template: boardTemplate,
      layers,
      layerIds,
      selection,
      connections,
    });
    return {
      title: boardTitle,
      template: boardTemplate,
      ...summary,
    };
  };

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    if (configured === false) {
      toast.error("Fred AI n'est pas configuré sur le serveur.");
      return;
    }

    const userMsg: FredChatMessage = { id: crypto.randomUUID(), role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const history = [...messages, userMsg]
        .filter((m) => m.id !== "welcome" && !m.pending)
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));

      const response = await sendFredMessage({
        message: trimmed,
        history: history.slice(0, -1),
        boardContext: getBoardContext(),
        boardId,
      });

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: response.reply,
          actions: response.actions?.length ? response.actions : undefined,
        },
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Fred n'a pas pu répondre");
    } finally {
      setLoading(false);
    }
  };

  const handleApplyActions = (msg: FredChatMessage) => {
    if (!msg.actions?.length) return;
    applyFredActions(msg.actions);
    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, actions: undefined } : m))
    );
  };

  return (
    <div className="pointer-events-auto absolute left-4 top-16 z-50 flex max-h-[calc(100vh-100px)] w-[min(100vw-2rem,22rem)] flex-col overflow-hidden rounded-2xl border border-neutral-200/80 bg-[#FDFCF8]/95 shadow-2xl shadow-black/10 backdrop-blur-md dark:border-neutral-700/80 dark:bg-neutral-950/95">
      <div className="flex items-center justify-between border-b border-neutral-200/80 px-4 py-3 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <FredAvatar />
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-semibold tracking-tight">Fred AI</h3>
              <Sparkles className="h-3 w-3 text-blue-500" />
            </div>
            <p className="text-[11px] text-neutral-500">Assistant Boardly · Gemini</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {configured === false && (
        <div className="border-b border-amber-200/80 bg-amber-50 px-4 py-2 text-[11px] text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          Clé API manquante côté serveur (<code className="text-[10px]">GOOGLE_AI_API_KEY</code>).
        </div>
      )}

      <div className="flex gap-1.5 overflow-x-auto border-b border-neutral-100 px-3 py-2 dark:border-neutral-800">
        {QUICK_PROMPTS.map(({ label, icon: Icon, prompt }) => (
          <button
            key={label}
            type="button"
            disabled={loading}
            onClick={() => sendMessage(prompt)}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-neutral-200/80 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-600 transition hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-blue-700 dark:hover:text-blue-300"
          >
            <Icon className="h-3 w-3" />
            {label}
          </button>
        ))}
      </div>

      <div ref={scrollRef} className="min-h-[220px] flex-1 space-y-4 overflow-y-auto p-4">
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          return (
            <div key={msg.id} className={cn("flex gap-2", isUser ? "flex-row-reverse" : "flex-row")}>
              {!isUser && <FredAvatar className="mt-0.5 h-7 w-7 shrink-0 text-xs" />}
              <div className={cn("max-w-[85%] space-y-2", isUser && "items-end")}>
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
        {loading && (
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            Fred réfléchit…
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void sendMessage(input);
        }}
        className="flex items-center gap-2 border-t border-neutral-200/80 p-3 dark:border-neutral-800"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Demande quelque chose à Fred…"
          className="h-9 flex-1 rounded-xl border-neutral-200 bg-white text-sm dark:border-neutral-700 dark:bg-neutral-900"
          disabled={loading}
        />
        <Button type="submit" size="icon" className="h-9 w-9 shrink-0 rounded-xl" disabled={!input.trim() || loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
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
