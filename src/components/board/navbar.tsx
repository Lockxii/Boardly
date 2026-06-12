import { ChevronLeft, MoreHorizontal, Pencil, ShieldAlert, MessageSquare, Keyboard, Moon, Sun, FileImage, FileCode, Presentation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { BoardlyBrand } from "@/components/boardly-brand";
import { useState, useRef, useEffect } from "react";
import { HistoryDialog } from "./history-dialog";
import { ShareDialog } from "./share-dialog";
import { TrashDialog } from "./trash-dialog";
import { ChatPanel } from "./chat-panel";
import { NavIconButton } from "./nav-icon-button";
import { FloatingDock, useFloatingDock } from "./floating-dock";
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
  const [isEditing, setIsEditing] = useState(false);
  const [newTitle, setNewTitle] = useState(title);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { setShowCommandPalette, darkMode, toggleDarkMode, setShowPresentation } = useCanvasStore();

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

  const onSubmit = async () => {
    if (newTitle === title || !newTitle.trim()) { setIsEditing(false); setNewTitle(title); return; }
    setIsEditing(false);
    updateTitleMutation.mutate(newTitle);
  };

  return (
    <>
      <FloatingDock
        id="navbar"
        defaultAnchor="top-center"
        defaultCompact
        toggleMode="compact"
        allowCenterSnap
        zIndex={30}
        collapsedContent={
          <>
            <BoardlyBrand to="/dashboard" showName={false} size={18} />
            <span className="max-w-[100px] truncate">{title}</span>
          </>
        }
      >
        <NavbarContent
          title={title}
          isEditing={isEditing}
          setIsEditing={setIsEditing}
          newTitle={newTitle}
          setNewTitle={setNewTitle}
          inputRef={inputRef}
          onSubmit={onSubmit}
          isChatOpen={isChatOpen}
          setIsChatOpen={setIsChatOpen}
          readOnly={readOnly}
          actualBoardId={actualBoardId}
          isPublic={isPublic}
          toggleDarkMode={toggleDarkMode}
          darkMode={darkMode}
          setShowCommandPalette={setShowCommandPalette}
          handleExport={handleExport}
          handleExportPNG={handleExportPNG}
          handleExportSVG={handleExportSVG}
          setShowPresentation={setShowPresentation}
        />
      </FloatingDock>
      {isChatOpen && <ChatPanel onClose={() => setIsChatOpen(false)} />}
    </>
  );
}

function NavbarContent({
  title,
  isEditing,
  setIsEditing,
  newTitle,
  setNewTitle,
  inputRef,
  onSubmit,
  isChatOpen,
  setIsChatOpen,
  readOnly,
  actualBoardId,
  isPublic,
  toggleDarkMode,
  darkMode,
  setShowCommandPalette,
  handleExport,
  handleExportPNG,
  handleExportSVG,
  setShowPresentation,
}: {
  title: string;
  isEditing: boolean;
  setIsEditing: (v: boolean) => void;
  newTitle: string;
  setNewTitle: (v: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onSubmit: () => void;
  isChatOpen: boolean;
  setIsChatOpen: (v: boolean) => void;
  readOnly: boolean;
  actualBoardId: string;
  isPublic: boolean;
  toggleDarkMode: () => void;
  darkMode: boolean;
  setShowCommandPalette: (v: boolean) => void;
  handleExport: () => void;
  handleExportPNG: () => void;
  handleExportSVG: () => void;
  setShowPresentation: (show: boolean) => void;
}) {
  const { vertical, compact } = useFloatingDock();
  const iconOnly = vertical || compact;
  const btnSize = vertical ? "h-8 w-8" : compact ? "h-8 w-8" : "h-9 w-9";
  const iconSize = vertical ? "h-4 w-4" : "h-5 w-5";

  return (
    <nav
      className={`flex min-w-0 items-center ${
        vertical ? "flex-col gap-0.5 py-0.5" : `flex-row ${compact ? "gap-0.5" : "gap-1.5"}`
      }`}
    >
      <div className={`flex shrink-0 items-center ${vertical ? "flex-col gap-0.5" : "gap-1"}`}>
        <Button variant="ghost" size="icon" asChild className={`${btnSize} shrink-0 hover:bg-neutral-100 dark:hover:bg-neutral-800`}>
          <Link to="/dashboard" title="Retour au dashboard">
            <ChevronLeft className={`${iconSize} text-neutral-600 dark:text-neutral-400`} />
          </Link>
        </Button>
        <span title={vertical ? title : undefined} className="shrink-0">
          <BoardlyBrand
            to="/dashboard"
            showName={false}
            size={vertical ? 22 : compact ? 24 : 28}
          />
        </span>
        {!vertical && (
          <>
            <div className="h-4 w-px shrink-0 bg-neutral-200 dark:bg-neutral-700" />
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
                className="max-w-[140px] rounded border border-blue-500/50 bg-white/20 px-2 py-0.5 text-sm font-semibold outline-none dark:bg-black/20 dark:text-white"
              />
            ) : (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="group flex max-w-[160px] items-center gap-1 rounded px-1.5 py-0.5 transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
                title={title}
              >
                <span className="truncate text-sm font-semibold dark:text-white">{title}</span>
                {!compact && (
                  <Pencil className="h-3 w-3 shrink-0 text-neutral-400 opacity-0 transition group-hover:opacity-100" />
                )}
              </button>
            )}
          </>
        )}
      </div>

      {!vertical && !compact && (
        <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-neutral-200/20 bg-white/10 px-2.5 py-1 dark:border-neutral-700/20 dark:bg-black/10">
          <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] font-medium text-neutral-700 dark:text-neutral-200">Vous</span>
        </div>
      )}

      {!vertical && !compact && <div className="h-4 w-px shrink-0 bg-neutral-200 dark:bg-neutral-700" />}

      <div className={`flex items-center ${vertical ? "flex-col gap-0.5" : "gap-0.5"}`}>
        <NavIconButton onClick={toggleDarkMode} title={darkMode ? "Mode clair" : "Mode sombre"} className={btnSize}>
          {darkMode ? <Sun className={iconSize} /> : <Moon className={iconSize} />}
        </NavIconButton>
        <NavIconButton onClick={() => setShowCommandPalette(true)} title="Commandes (Ctrl+K)" className={btnSize}>
          <Keyboard className={iconSize} />
        </NavIconButton>
        {!readOnly && (
          <NavIconButton onClick={() => setShowPresentation(true)} title="Présentation (Shift+P)" className={btnSize}>
            <Presentation className={iconSize} />
          </NavIconButton>
        )}
        <NavIconButton active={isChatOpen} onClick={() => setIsChatOpen(!isChatOpen)} title="Discussion" className={btnSize}>
          <MessageSquare className={iconSize} />
        </NavIconButton>
        <HistoryDialog />
        {!readOnly && <TrashDialog />}
        {!readOnly && actualBoardId && (
          <ShareDialog boardId={actualBoardId} isPublic={isPublic} iconOnly={iconOnly} />
        )}
        {readOnly && !vertical && (
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
            Lecture seule
          </span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <NavIconButton title="Plus d'options" className={btnSize}>
              <MoreHorizontal className={iconSize} />
            </NavIconButton>
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
  );
}
