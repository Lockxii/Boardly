import { ChevronLeft, Share2, MoreHorizontal, Check, Pencil, ShieldAlert, MessageSquare, Keyboard, Moon, Sun, FileImage, FileCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { BoardlyBrand } from "@/components/boardly-brand";
import { useState, useRef, useEffect } from "react";
import { InviteDialog } from "./invite-dialog";
import { TeamDialog } from "./team-dialog";
import { HistoryDialog } from "./history-dialog";
import { ShareDialog } from "./share-dialog";
import { TrashDialog } from "./trash-dialog";
import { ChatPanel } from "./chat-panel";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { apiFetch } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { useCanvasStore } from "@/store/canvas-store";

interface NavbarProps {
  title: string;
  boardId?: string;
  isPublic?: boolean;
  readOnly?: boolean;
}

export function Navbar({ title, boardId, isPublic = false, readOnly = false }: NavbarProps) {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newTitle, setNewTitle] = useState(title);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { setShowCommandPalette, darkMode, toggleDarkMode } = useCanvasStore();

  const actualBoardId = boardId || "";

  useEffect(() => { setNewTitle(title); }, [title]);

  const updateTitleMutation = useMutation({
    mutationFn: (newT: string) => apiFetch(`/api/boards/${actualBoardId}/title`, { method: "PUT", body: JSON.stringify({ title: newT }) }),
    onError: () => setNewTitle(title),
  });

  const handleExport = async () => {
    const svg = document.querySelector("#board-canvas") as SVGSVGElement;
    if (!svg) return;
    toast.promise(
      new Promise(async (resolve, reject) => {
        try {
          const clone = svg.cloneNode(true) as SVGSVGElement;
          const svgData = new XMLSerializer().serializeToString(clone);
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          const img = new Image();
          const { width, height } = svg.getBoundingClientRect();
          canvas.width = width * 2;
          canvas.height = height * 2;
          img.onload = () => {
            if (!ctx) return reject("No context");
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.scale(2, 2);
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
            const link = document.createElement("a");
            link.download = `${title || "board"}.jpg`;
            link.href = dataUrl;
            link.click();
            resolve(true);
          };
          img.onerror = (e) => reject(e);
          img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
        } catch (error) { reject(error); }
      }),
      { loading: "Génération de l'image...", success: "Image téléchargée !", error: "Erreur lors de l'export" }
    );
  };

  const handleExportPNG = async () => {
    const svg = document.querySelector("#board-canvas") as SVGSVGElement;
    if (!svg) return;
    toast.promise(
      new Promise(async (resolve, reject) => {
        try {
          const clone = svg.cloneNode(true) as SVGSVGElement;
          const svgData = new XMLSerializer().serializeToString(clone);
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          const img = new Image();
          const { width, height } = svg.getBoundingClientRect();
          canvas.width = width * 2;
          canvas.height = height * 2;
          img.onload = () => {
            if (!ctx) return reject("No context");
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.scale(2, 2);
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob((blob) => {
              if (!blob) return reject("No blob");
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.download = `${title || "board"}.png`;
              link.href = url;
              link.click();
              URL.revokeObjectURL(url);
              resolve(true);
            }, "image/png");
          };
          img.onerror = (e) => reject(e);
          img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
        } catch (error) { reject(error); }
      }),
      { loading: "Génération PNG...", success: "PNG téléchargé !", error: "Erreur export PNG" }
    );
  };

  const handleExportSVG = () => {
    const svg = document.querySelector("#board-canvas") as SVGSVGElement;
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgData], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `${title || "board"}.svg`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("SVG téléchargé !");
  };

  const onCopy = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const onSubmit = async () => {
    if (newTitle === title || !newTitle.trim()) { setIsEditing(false); setNewTitle(title); return; }
    setIsEditing(false);
    updateTitleMutation.mutate(newTitle);
  };

  return (
    <>
      <nav className="absolute top-4 left-4 right-4 h-14 flex items-center bg-white/85 dark:bg-neutral-900/85 backdrop-blur-md rounded-xl border border-neutral-200/70 dark:border-neutral-700/70 shadow-sm shadow-black/[0.04] px-3 sm:px-4 pointer-events-auto z-20 transition-all">
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
          <Button variant="ghost" size="icon" asChild className="h-9 w-9 shrink-0 hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <Link to="/dashboard" title="Retour au dashboard">
              <ChevronLeft className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
            </Link>
          </Button>
          <BoardlyBrand to="/dashboard" showName={false} size={28} className="hidden sm:flex shrink-0" />
          <div className="h-6 w-px bg-neutral-200 dark:bg-neutral-700 shrink-0" />
          {isEditing ? (
            <input
              ref={inputRef}
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onBlur={onSubmit}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSubmit();
                if (e.key === "Escape") { setIsEditing(false); setNewTitle(title); }
              }}
              className="text-sm font-semibold bg-white/20 dark:bg-black/20 outline-none px-2 py-1 rounded border border-blue-500/50 dark:text-white"
            />
          ) : (
            <div onClick={() => setIsEditing(true)} className="flex items-center gap-2 cursor-pointer hover:bg-white/10 dark:hover:bg-black/10 px-2 py-1 rounded transition group">
              <h1 className="text-sm font-semibold truncate max-w-[200px] dark:text-white">{title}</h1>
              <Pencil className="h-3 w-3 text-neutral-400 opacity-0 group-hover:opacity-100 transition" />
            </div>
          )}
        </div>

        <div className="hidden lg:flex items-center bg-white/10 dark:bg-black/10 px-3 py-1.5 rounded-full gap-3 mr-4 border border-neutral-200/20 dark:border-neutral-700/20">
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 bg-green-500 rounded-full animate-pulse" />
            <span className="text-[11px] font-medium text-neutral-700 dark:text-neutral-200">Vous</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-white/20 text-neutral-600 dark:text-neutral-400" onClick={toggleDarkMode} title={darkMode ? "Mode clair" : "Mode sombre"}>
            {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-white/20 text-neutral-600 dark:text-neutral-400" onClick={() => setShowCommandPalette(true)} title="Commandes (Ctrl+K)">
            <Keyboard className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className={`h-9 w-9 hover:bg-white/20 ${isChatOpen ? "bg-white/20 text-blue-500" : "text-neutral-600 dark:text-neutral-400"}`} onClick={() => setIsChatOpen(!isChatOpen)} title="Discussion">
            <MessageSquare className="h-5 w-5" />
          </Button>
          <HistoryDialog />
          {!readOnly && <TrashDialog />}
          {!readOnly && <TeamDialog boardId={actualBoardId} />}
          {!readOnly && <InviteDialog boardId={actualBoardId} />}
          {!readOnly && actualBoardId && <ShareDialog boardId={actualBoardId} isPublic={isPublic} />}
          {!readOnly && (
            <Button variant="outline" size="sm" className={`h-9 gap-2 transition-all duration-300 ${copied ? "bg-green-500 text-white border-green-500" : "bg-white/10 text-blue-600 border-blue-200/50 dark:border-blue-800/50 dark:text-blue-400"}`} onClick={onCopy}>
              {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
              <span className="hidden sm:inline">{copied ? "Copié !" : "Lien"}</span>
            </Button>
          )}
          {readOnly && (
            <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-3 py-1 rounded-full">Lecture seule</span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-white/20 dark:hover:bg-neutral-700/20"><MoreHorizontal className="h-5 w-5 text-neutral-600 dark:text-neutral-400" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Exporter</DropdownMenuLabel>
              <DropdownMenuItem onClick={handleExport} className="gap-2 cursor-pointer"><FileImage className="h-4 w-4" /> JPEG</DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPNG} className="gap-2 cursor-pointer"><FileImage className="h-4 w-4" /> PNG</DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportSVG} className="gap-2 cursor-pointer"><FileCode className="h-4 w-4" /> SVG</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-600 dark:text-red-400 gap-2 cursor-pointer"><ShieldAlert className="h-4 w-4" /> Signaler un abus</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>
      {isChatOpen && <ChatPanel onClose={() => setIsChatOpen(false)} />}
    </>
  );
}
