import { useCanvasStore } from "@/store/canvas-store";
import { MousePointer2, Square, Circle, Type, StickyNote, Redo, Undo, Image as ImageIcon, Pencil, Triangle as TriangleIcon, MoveRight, Diamond, Star, Layers, Eraser, GripHorizontal, ChevronLeft, Shapes, PenTool, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { nanoid } from "nanoid";
import { useRef, useState } from "react";
import { LayersPanel } from "./layers-panel";
import { motion } from "framer-motion";
import type { Layer, LayerType } from "@/lib/types";

export function Toolbar() {
  const canvasState = useCanvasStore((s) => s.canvasState);
  const setCanvasState = useCanvasStore((s) => s.setCanvasState);
  const pencilTool = useCanvasStore((s) => s.pencilTool);
  const setPencilTool = useCanvasStore((s) => s.setPencilTool);
  const camera = useCanvasStore((s) => s.camera);
  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);
  const canUndo = useCanvasStore((s) => s.canUndo);
  const canRedo = useCanvasStore((s) => s.canRedo);
  const lastUsedColor = useCanvasStore((s) => s.lastUsedColor);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isShapeActive = canvasState.mode === "inserting" && ["Rectangle", "Ellipse", "Triangle", "Arrow", "Diamond", "Star"].includes(canvasState.layerType);
  const isDrawingActive = canvasState.mode === "pencil";
  const isContentActive = canvasState.mode === "inserting" && ["Text", "Note", "Image"].includes(canvasState.layerType);

  const toggleMenu = (menu: string) => setOpenMenu(openMenu === menu ? null : menu);

  const insertImage = (src: string) => {
    const centerX = (window.innerWidth / 2 - camera.x) / camera.zoom;
    const centerY = (window.innerHeight / 2 - camera.y) / camera.zoom;
    const id = nanoid();
    useCanvasStore.getState().pushHistory();
    useCanvasStore.setState((s) => ({
      layers: { ...s.layers, [id]: { type: "Image" as LayerType, x: centerX - 100, y: centerY - 100, height: 200, width: 200, fill: "", src } as Layer },
      layerIds: [...s.layerIds, id],
      selection: [id],
    }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => { const src = event.target?.result as string; if (src) insertImage(src); };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <motion.div drag dragMomentum={false} layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="absolute top-1/2 left-4 -translate-y-1/2 flex flex-col gap-1 pointer-events-none z-[30]">
      <div className="flex flex-col gap-1 bg-white dark:bg-neutral-800 p-1.5 rounded-xl shadow-xl border border-neutral-200 dark:border-neutral-700 pointer-events-auto items-center min-w-[44px]">
        <div className="cursor-grab active:cursor-grabbing p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-md transition mb-0.5">
          <GripHorizontal className="h-3.5 w-3.5 text-neutral-400" />
        </div>

        {!isCollapsed && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="flex flex-col gap-1 items-center">
            <ToolButton isActive={canvasState.mode === "none" || canvasState.mode === "translating" || canvasState.mode === "selectionNet" || canvasState.mode === "resizing"} onClick={() => { setCanvasState({ mode: "none" }); setOpenMenu(null); }} icon={MousePointer2} title="Sélectionner (V)" />

            <div className="h-[1px] bg-neutral-100 dark:bg-neutral-700 w-full my-0.5" />

            <div className="relative">
              <ToolButton isActive={isShapeActive || openMenu === "shapes"} onClick={() => toggleMenu("shapes")} icon={Shapes} title="Formes" />
              {openMenu === "shapes" && (
                <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="absolute left-12 top-0 flex flex-row gap-1 bg-white dark:bg-neutral-800 p-1.5 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-700">
                  {[
                    { type: "Rectangle" as LayerType, icon: Square, title: "Rectangle" },
                    { type: "Ellipse" as LayerType, icon: Circle, title: "Ellipse" },
                    { type: "Triangle" as LayerType, icon: TriangleIcon, title: "Triangle" },
                    { type: "Arrow" as LayerType, icon: MoveRight, title: "Flèche" },
                    { type: "Diamond" as LayerType, icon: Diamond, title: "Losange" },
                    { type: "Star" as LayerType, icon: Star, title: "Étoile" },
                  ].map(({ type, icon, title }) => (
                    <ToolButton key={type} isActive={canvasState.mode === "inserting" && canvasState.layerType === type} onClick={() => { setCanvasState({ mode: "inserting", layerType: type }); setOpenMenu(null); }} icon={icon} title={title} />
                  ))}
                </motion.div>
              )}
            </div>

            <div className="relative">
              <ToolButton isActive={isContentActive || openMenu === "content"} onClick={() => toggleMenu("content")} icon={Plus} title="Ajouter" />
              {openMenu === "content" && (
                <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="absolute left-12 top-0 flex flex-row gap-1 bg-white dark:bg-neutral-800 p-1.5 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-700">
                  <ToolButton isActive={canvasState.mode === "inserting" && canvasState.layerType === "Note"} onClick={() => { setCanvasState({ mode: "inserting", layerType: "Note" }); setOpenMenu(null); }} icon={StickyNote} title="Note" />
                  <ToolButton isActive={canvasState.mode === "inserting" && canvasState.layerType === "Text"} onClick={() => { setCanvasState({ mode: "inserting", layerType: "Text" }); setOpenMenu(null); }} icon={Type} title="Texte" />
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700" onClick={() => { fileInputRef.current?.click(); setOpenMenu(null); }} title="Image"><ImageIcon className="h-4.5 w-4.5" /></Button>
                </motion.div>
              )}
            </div>

            <div className="relative">
              <ToolButton isActive={isDrawingActive || openMenu === "drawing"} onClick={() => toggleMenu("drawing")} icon={PenTool} title="Dessin" />
              {openMenu === "drawing" && (
                <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="absolute left-12 top-0 flex flex-row gap-1 bg-white dark:bg-neutral-800 p-1.5 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-700">
                  <ToolButton isActive={canvasState.mode === "pencil" && pencilTool === "draw"} onClick={() => { setCanvasState({ mode: "pencil" }); setPencilTool("draw"); setOpenMenu(null); }} icon={Pencil} title="Crayon" />
                  <ToolButton isActive={canvasState.mode === "pencil" && pencilTool === "erase"} onClick={() => { setCanvasState({ mode: "pencil" }); setPencilTool("erase"); setOpenMenu(null); }} icon={Eraser} title="Gomme" />
                </motion.div>
              )}
            </div>

            <div className="h-[1px] bg-neutral-100 dark:bg-neutral-700 w-full my-0.5" />

            <div className="relative">
              <ToolButton isActive={openMenu === "layers"} onClick={() => toggleMenu("layers")} icon={Layers} title="Calques" />
              {openMenu === "layers" && <LayersPanel />}
            </div>

            <div className="h-[1px] bg-neutral-200 dark:bg-neutral-700 my-0.5 w-full" />
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg" onClick={undo} disabled={!canUndo} title="Annuler (Ctrl+Z)"><Undo className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg" onClick={redo} disabled={!canRedo} title="Rétablir (Ctrl+Shift+Z)"><Redo className="h-3.5 w-3.5" /></Button>
          </motion.div>
        )}

        <div className="h-[1px] bg-neutral-200 dark:bg-neutral-700 my-0.5 w-full" />
        <Button variant="ghost" size="icon" onClick={() => setIsCollapsed(!isCollapsed)} className="h-8 w-8 text-neutral-400">
          <motion.div animate={{ rotate: isCollapsed ? 180 : 0 }} transition={{ duration: 0.3 }}><ChevronLeft className="h-4 w-4" /></motion.div>
        </Button>
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
    </motion.div>
  );
}

function ToolButton({ isActive, onClick, icon: Icon, title }: { isActive: boolean; onClick: () => void; icon: any; title: string }) {
  return (
    <Button variant={isActive ? "secondary" : "ghost"} size="icon" onClick={onClick} title={title} className={`h-9 w-9 rounded-lg ${isActive ? "bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200" : "hover:bg-neutral-100 dark:hover:bg-neutral-700"}`}>
      <Icon className="h-4.5 w-4.5" />
    </Button>
  );
}
