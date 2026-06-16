import { useCanvasStore } from "@/store/canvas-store";
import {
  MousePointer2, Square, Circle, Type, StickyNote, Redo, Undo, Image as ImageIcon, Pencil,
  Triangle as TriangleIcon, MoveRight, Diamond, Star, Layers, Eraser, Shapes, PenTool, Plus,
  Hand, Minus, Frame, Link2, Columns3, Mic, Pause, Play, CircleStop, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useVoiceRecorder } from "@/lib/use-voice-recorder";
import { nanoid } from "nanoid";
import { useRef, useState, useEffect } from "react";
import { LayersPanel } from "./layers-panel";
import { motion } from "framer-motion";
import type { Layer, LayerType } from "@/lib/types";
import { compressImageFile } from "@/lib/canvas-utils";
import { getDefaultPastePoint, pasteUrlsAt } from "@/lib/link-paste-actions";
import { LinkPasteDialog } from "./link-paste-dialog";
import { FloatingDock } from "./floating-dock";
import { useFloatingDock } from "./floating-dock-context";
import { dataUrlFromBlob, uploadDataUrl } from "@/lib/upload-file";

export function Toolbar({ boardId }: { boardId?: string }) {
  const readOnly = useCanvasStore((s) => s.readOnly);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);

  if (readOnly) return null;

  return (
    <>
      <FloatingDock
        id="toolbar"
        defaultAnchor="left-center"
        zIndex={35}
        collapsedContent={
          <>
            <MousePointer2 className="h-3.5 w-3.5 text-neutral-500" />
            <span className="text-xs font-medium">Outils</span>
          </>
        }
      >
        <ToolbarContent onOpenLinkDialog={() => setLinkDialogOpen(true)} boardId={boardId} />
      </FloatingDock>
      <LinkPasteDialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen} onSubmit={handleLinkPasteGlobal} />
    </>
  );
}

async function handleLinkPasteGlobal(urls: string[]) {
  const camera = useCanvasStore.getState().camera;
  await pasteUrlsAt(urls, getDefaultPastePoint(camera));
}

function ToolbarContent({
  onOpenLinkDialog,
  boardId,
}: {
  onOpenLinkDialog: () => void;
  boardId?: string;
}) {
  const canvasState = useCanvasStore((s) => s.canvasState);
  const setCanvasState = useCanvasStore((s) => s.setCanvasState);
  const pencilTool = useCanvasStore((s) => s.pencilTool);
  const setPencilTool = useCanvasStore((s) => s.setPencilTool);
  const camera = useCanvasStore((s) => s.camera);
  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);
  const canUndo = useCanvasStore((s) => s.canUndo);
  const canRedo = useCanvasStore((s) => s.canRedo);
  const setConnectFromId = useCanvasStore((s) => s.setConnectFromId);
  const connectFromId = useCanvasStore((s) => s.connectFromId);
  const { vertical, anchor } = useFloatingDock();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const submenuClass =
    anchor === "right-center"
      ? "absolute right-12 top-0"
      : "absolute left-12 top-0";

  const isShapeActive =
    canvasState.mode === "inserting" &&
    ["Rectangle", "Ellipse", "Triangle", "Arrow", "Diamond", "Star"].includes(canvasState.layerType);
  const isDrawingActive = canvasState.mode === "pencil";
  const isContentActive =
    canvasState.mode === "inserting" && ["Text", "Note", "Image"].includes(canvasState.layerType);

  const toggleMenu = (menu: string) => setOpenMenu(openMenu === menu ? null : menu);
  const closeMenus = () => setOpenMenu(null);

  const insertImage = (src: string) => {
    const centerX = (window.innerWidth / 2 - camera.x) / camera.zoom;
    const centerY = (window.innerHeight / 2 - camera.y) / camera.zoom;
    const id = nanoid();
    useCanvasStore.getState().pushHistory();
    useCanvasStore.setState((s) => ({
      layers: {
        ...s.layers,
        [id]: { type: "Image" as LayerType, x: centerX - 100, y: centerY - 100, height: 200, width: 200, fill: "", src } as Layer,
      },
      layerIds: [...s.layerIds, id],
      selection: [id],
    }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const toastId = toast.loading("Envoi de l'image…");
    try {
      const data = await compressImageFile(file);
      const uploadName = `${(file.name || "image").replace(/\.[^.]+$/, "")}.jpg`;
      const { url } = await uploadDataUrl({
        name: uploadName,
        type: "image/jpeg",
        size: Math.ceil(data.length * 0.75),
        data,
        boardId,
      });
      insertImage(url);
      toast.success("Image ajoutée", { id: toastId });
    } catch {
      toast.error("Échec de l'envoi de l'image", { id: toastId });
    }
    e.target.value = "";
  };

  const handleVoiceComplete = async (blob: Blob, durationSec: number) => {
    const toastId = toast.loading("Envoi de la note vocale…");
    try {
      const dataUrl = await dataUrlFromBlob(blob);
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: `note-vocale-${Date.now()}.webm`,
          type: blob.type,
          size: blob.size,
          data: dataUrl,
          boardId,
        }),
      });
      if (!res.ok) throw new Error();
      const { url } = (await res.json()) as { url: string };
      useCanvasStore.getState().insertAudioCard(url, durationSec);
      toast.success("Note vocale ajoutée", { id: toastId });
    } catch {
      toast.error("Échec de l'envoi de la note vocale", { id: toastId });
    }
  };
  const voice = useVoiceRecorder(handleVoiceComplete);
  const startVoice = () => void voice.start().catch(() => toast.error("Micro indisponible"));
  const toggleVoice = () => {
    if (!voice.active) startVoice();
    else if (voice.paused) voice.resume();
    else voice.pause();
  };

  // Bridge: the slash (/) menu requests image/link/voice tools hosted here.
  const requestTool = useCanvasStore((s) => s.requestTool);
  useEffect(() => {
    if (!requestTool) return;
    if (requestTool === "image") fileInputRef.current?.click();
    else if (requestTool === "link") onOpenLinkDialog();
    else if (requestTool === "voice") startVoice();
    useCanvasStore.getState().setRequestTool(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestTool]);

  const dismissConnectionTools = useCanvasStore((s) => s.dismissConnectionTools);

  const startConnectMode = () => {
    if (connectFromId) {
      dismissConnectionTools();
      return;
    }
    const sel = useCanvasStore.getState().selection;
    if (sel.length === 0) return;
    setConnectFromId(sel[0]);
    closeMenus();
  };

  return (
    <>
    <div className={`flex items-center ${vertical ? "flex-col gap-0.5 py-0.5" : "flex-row gap-0.5"}`}>
      <ToolButton
        isActive={
          canvasState.mode === "none" ||
          canvasState.mode === "translating" ||
          canvasState.mode === "selectionNet" ||
          canvasState.mode === "resizing"
        }
        onClick={() => {
          setCanvasState({ mode: "none" });
          setConnectFromId(null);
          closeMenus();
        }}
        icon={MousePointer2}
        title="Sélectionner (V)"
      />
      <ToolButton
        isActive={canvasState.mode === "panning"}
        onClick={() => {
          setCanvasState({ mode: "panning" });
          setConnectFromId(null);
          closeMenus();
        }}
        icon={Hand}
        title="Main (H)"
      />
      <ToolButton
        isActive={canvasState.mode === "inserting" && canvasState.layerType === "Line"}
        onClick={() => {
          setCanvasState({ mode: "inserting", layerType: "Line" });
          setConnectFromId(null);
          closeMenus();
        }}
        icon={Minus}
        title="Ligne (L)"
      />
      <ToolButton
        isActive={canvasState.mode === "inserting" && canvasState.layerType === "Frame"}
        onClick={() => {
          setCanvasState({ mode: "inserting", layerType: "Frame" });
          setConnectFromId(null);
          closeMenus();
        }}
        icon={Frame}
        title="Cadre (Shift+F)"
      />
      <ToolButton
        isActive={canvasState.mode === "inserting" && canvasState.layerType === "Column"}
        onClick={() => {
          setCanvasState({ mode: "inserting", layerType: "Column" });
          setConnectFromId(null);
          closeMenus();
        }}
        icon={Columns3}
        title="Colonne Kanban"
      />
      <ToolButton isActive={!!connectFromId} onClick={startConnectMode} icon={Link2} title="Relier" />

      <div className={`bg-neutral-200 dark:bg-neutral-700 ${vertical ? "h-px w-5 my-0.5" : "h-5 w-px mx-0.5"}`} />

      <div className="relative">
        <ToolButton isActive={isShapeActive || openMenu === "shapes"} onClick={() => toggleMenu("shapes")} icon={Shapes} title="Formes" />
        {openMenu === "shapes" && (
          <motion.div
            initial={{ opacity: 0, x: anchor === "right-center" ? -10 : 10 }}
            animate={{ opacity: 1, x: 0 }}
            className={`${submenuClass} flex flex-row gap-1 rounded-lg border border-neutral-200 bg-white p-1.5 shadow-xl dark:border-neutral-700 dark:bg-neutral-800`}
          >
            {[
              { type: "Rectangle" as LayerType, icon: Square, title: "Rectangle" },
              { type: "Ellipse" as LayerType, icon: Circle, title: "Ellipse" },
              { type: "Triangle" as LayerType, icon: TriangleIcon, title: "Triangle" },
              { type: "Arrow" as LayerType, icon: MoveRight, title: "Flèche" },
              { type: "Diamond" as LayerType, icon: Diamond, title: "Losange" },
              { type: "Star" as LayerType, icon: Star, title: "Étoile" },
            ].map(({ type, icon, title }) => (
              <ToolButton
                key={type}
                isActive={canvasState.mode === "inserting" && canvasState.layerType === type}
                onClick={() => {
                  setCanvasState({ mode: "inserting", layerType: type });
                  closeMenus();
                }}
                icon={icon}
                title={title}
              />
            ))}
          </motion.div>
        )}
      </div>

      <div className="relative">
        <ToolButton isActive={isContentActive || openMenu === "content"} onClick={() => toggleMenu("content")} icon={Plus} title="Ajouter" />
        {openMenu === "content" && (
          <motion.div
            initial={{ opacity: 0, x: anchor === "right-center" ? -10 : 10 }}
            animate={{ opacity: 1, x: 0 }}
            className={`${submenuClass} flex flex-row gap-1 rounded-lg border border-neutral-200 bg-white p-1.5 shadow-xl dark:border-neutral-700 dark:bg-neutral-800`}
          >
            <ToolButton
              isActive={canvasState.mode === "inserting" && canvasState.layerType === "Note"}
              onClick={() => {
                setCanvasState({ mode: "inserting", layerType: "Note" });
                closeMenus();
              }}
              icon={StickyNote}
              title="Note"
            />
            <ToolButton
              isActive={canvasState.mode === "inserting" && canvasState.layerType === "Text"}
              onClick={() => {
                setCanvasState({ mode: "inserting", layerType: "Text" });
                closeMenus();
              }}
              icon={Type}
              title="Texte"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700"
              onClick={() => {
                fileInputRef.current?.click();
                closeMenus();
              }}
              title="Image"
            >
              <ImageIcon className="h-4.5 w-4.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700"
              onClick={() => {
                closeMenus();
                onOpenLinkDialog();
              }}
              title="Carte lien"
            >
              <Link2 className="h-4.5 w-4.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={`h-9 w-9 rounded-lg ${voice.active ? "bg-red-500 text-white hover:bg-red-600" : "hover:bg-neutral-100 dark:hover:bg-neutral-700"}`}
              onClick={toggleVoice}
              title={voice.active ? `${voice.paused ? "Reprendre" : "Pause"} (${voice.elapsed}s)` : "Note vocale"}
            >
              {voice.active ? (
                <span className="text-[11px] font-semibold tabular-nums">{voice.elapsed}s</span>
              ) : (
                <Mic className="h-4.5 w-4.5" />
              )}
            </Button>
          </motion.div>
        )}
      </div>

      <Button
        variant="ghost"
        size="icon"
        className={`h-9 w-9 rounded-lg ${
          voice.active ? "bg-red-500 text-white hover:bg-red-600" : "hover:bg-neutral-100 dark:hover:bg-neutral-700"
        }`}
        onClick={toggleVoice}
        title={voice.active ? `${voice.paused ? "Reprendre" : "Pause"} l'enregistrement` : "Note vocale"}
      >
        {voice.active ? (
          voice.paused ? <Play className="h-4.5 w-4.5" /> : <Pause className="h-4.5 w-4.5" />
        ) : (
          <Mic className="h-4.5 w-4.5" />
        )}
      </Button>

      <div className="relative">
        <ToolButton isActive={isDrawingActive || openMenu === "drawing"} onClick={() => toggleMenu("drawing")} icon={PenTool} title="Dessin" />
        {openMenu === "drawing" && (
          <motion.div
            initial={{ opacity: 0, x: anchor === "right-center" ? -10 : 10 }}
            animate={{ opacity: 1, x: 0 }}
            className={`${submenuClass} flex flex-row gap-1 rounded-lg border border-neutral-200 bg-white p-1.5 shadow-xl dark:border-neutral-700 dark:bg-neutral-800`}
          >
            <ToolButton
              isActive={canvasState.mode === "pencil" && pencilTool === "draw"}
              onClick={() => {
                setCanvasState({ mode: "pencil" });
                setPencilTool("draw");
                closeMenus();
              }}
              icon={Pencil}
              title="Crayon"
            />
            <ToolButton
              isActive={canvasState.mode === "pencil" && pencilTool === "erase"}
              onClick={() => {
                setCanvasState({ mode: "pencil" });
                setPencilTool("erase");
                closeMenus();
              }}
              icon={Eraser}
              title="Gomme"
            />
          </motion.div>
        )}
      </div>

      <div className={`bg-neutral-200 dark:bg-neutral-700 ${vertical ? "h-px w-5 my-0.5" : "h-5 w-px mx-0.5"}`} />

      <div className="relative">
        <ToolButton isActive={openMenu === "layers"} onClick={() => toggleMenu("layers")} icon={Layers} title="Calques" />
        {openMenu === "layers" && <LayersPanel />}
      </div>

      <div className={`bg-neutral-200 dark:bg-neutral-700 ${vertical ? "h-px w-5 my-0.5" : "h-5 w-px mx-0.5"}`} />

      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700" onClick={undo} disabled={!canUndo} title="Annuler (Ctrl+Z)">
        <Undo className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700" onClick={redo} disabled={!canRedo} title="Rétablir (Ctrl+Shift+Z)">
        <Redo className="h-3.5 w-3.5" />
      </Button>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
    </div>
    {voice.active && (
      <VoiceRecorderPanel
        elapsed={voice.elapsed}
        paused={voice.paused}
        onPause={voice.pause}
        onResume={voice.resume}
        onStop={voice.stop}
        onCancel={voice.cancel}
      />
    )}
    </>
  );
}

function formatVoiceTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function VoiceRecorderPanel({
  elapsed,
  paused,
  onPause,
  onResume,
  onStop,
  onCancel,
}: {
  elapsed: number;
  paused: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full border border-red-200 bg-white px-3 py-2 shadow-2xl shadow-red-950/10 dark:border-red-900/60 dark:bg-neutral-900">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white">
        <Mic className="h-4 w-4" />
      </span>
      <span className="min-w-12 text-sm font-semibold tabular-nums text-neutral-900 dark:text-white">
        {formatVoiceTime(elapsed)}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-full"
        onClick={paused ? onResume : onPause}
        title={paused ? "Reprendre" : "Pause"}
      >
        {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-full text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950/40"
        onClick={onStop}
        title="Terminer"
      >
        <CircleStop className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-full text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
        onClick={onCancel}
        title="Annuler"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

function ToolButton({
  isActive,
  onClick,
  icon: Icon,
  title,
}: {
  isActive: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <Button
      variant={isActive ? "secondary" : "ghost"}
      size="icon"
      onClick={onClick}
      title={title}
      className={`h-9 w-9 rounded-lg ${isActive ? "bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200" : "hover:bg-neutral-100 dark:hover:bg-neutral-700"}`}
    >
      <Icon className="h-4.5 w-4.5" />
    </Button>
  );
}
