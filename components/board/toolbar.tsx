"use client";

import { useCanvasStore } from "@/store/use-canvas-store";
import { Layer, LayerType, useMutation } from "@/liveblocks.config";
import { MousePointer2, Square, Circle, Type, StickyNote, Redo, Undo, Image as ImageIcon, Pencil, Triangle as TriangleIcon, MoveRight, Diamond, Star, Layers, Eraser, GripHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCanRedo, useCanUndo, useHistory, useMyPresence } from "@/liveblocks.config";
import { nanoid } from "nanoid";
import { LiveObject } from "@liveblocks/client";
import { useRef, useState } from "react";
import { LayersPanel } from "./layers-panel";
import { motion, AnimatePresence } from "framer-motion";

export function Toolbar() {
    const { canvasState, setCanvasState, camera, pencilTool, setPencilTool } = useCanvasStore();
    const history = useHistory();
    const canUndo = useCanUndo();
    const canRedo = useCanRedo();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showShapesMenu, setShowShapesMenu] = useState(false);
    const [showLayersPanel, setShowLayersPanel] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);

    const isShapeActive = canvasState.mode === "inserting" && ["Triangle", "Arrow", "Diamond", "Star"].includes(canvasState.layerType);

    const insertImage = useMutation(({ storage, setMyPresence }, src: string) => {
        const liveLayers = storage.get("layers");
        const liveLayerIds = storage.get("layerIds");
        const layerId = nanoid();
        const centerX = (window.innerWidth / 2 - camera.x) / camera.zoom;
        const centerY = (window.innerHeight / 2 - camera.y) / camera.zoom;
        const layer = new LiveObject<Layer>({ type: "Image", x: centerX - 100, y: centerY - 100, height: 200, width: 200, fill: "", src: src });
        liveLayers.set(layerId, layer);
        liveLayerIds.push(layerId);
        setMyPresence({ selection: [layerId] }, { addToHistory: true });
    }, [camera]);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => { const src = event.target?.result as string; if (src) insertImage(src); };
        reader.readAsDataURL(file);
        e.target.value = "";
    };

    return (
        <motion.div 
            drag
            dragMomentum={false}
            layout
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="absolute top-1/2 left-4 -translate-y-1/2 flex flex-col gap-1 pointer-events-none z-[30]"
        >
            <div className="flex flex-col gap-1 bg-white dark:bg-neutral-800 p-1.5 rounded-xl shadow-xl border border-neutral-200 dark:border-neutral-700 pointer-events-auto items-center min-w-[44px]">
                <div className="cursor-grab active:cursor-grabbing p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-md transition mb-0.5">
                    <GripHorizontal className="h-3.5 w-3.5 text-neutral-400" />
                </div>

                <AnimatePresence>
                    {!isCollapsed && (
                        <motion.div 
                            initial={{ opacity: 0, height: 0, scale: 0.9 }}
                            animate={{ opacity: 1, height: "auto", scale: 1 }}
                            exit={{ opacity: 0, height: 0, scale: 0.9 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                            className="flex flex-col gap-1 items-center overflow-hidden"
                        >
                            <ToolButton isActive={canvasState.mode === "none" || canvasState.mode === "translating" || canvasState.mode === "selectionNet" || canvasState.mode === "resizing"} onClick={() => { setCanvasState({ mode: "none" }); setShowShapesMenu(false); setShowLayersPanel(false); }} icon={MousePointer2} title="Sélectionner" />
                            <ToolButton isActive={canvasState.mode === "inserting" && canvasState.layerType === "Rectangle"} onClick={() => { setCanvasState({ mode: "inserting", layerType: "Rectangle" }); setShowShapesMenu(false); setShowLayersPanel(false); }} icon={Square} title="Rectangle" />
                            <ToolButton isActive={canvasState.mode === "inserting" && canvasState.layerType === "Ellipse"} onClick={() => { setCanvasState({ mode: "inserting", layerType: "Ellipse" }); setShowShapesMenu(false); setShowLayersPanel(false); }} icon={Circle} title="Cercle" />
                            
                            <div className="relative">
                                <ToolButton isActive={isShapeActive || showShapesMenu} onClick={() => { setShowShapesMenu(!showShapesMenu); setShowLayersPanel(false); }} icon={TriangleIcon} title="Formes" />
                                {showShapesMenu && (
                                    <motion.div 
                                        initial={{ opacity: 0, x: 10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="absolute left-12 top-0 flex flex-row gap-1.5 bg-white dark:bg-neutral-800 p-1.5 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-700"
                                    >
                                        <ToolButton isActive={canvasState.mode === "inserting" && canvasState.layerType === "Triangle"} onClick={() => { setCanvasState({ mode: "inserting", layerType: "Triangle" }); setShowShapesMenu(false); }} icon={TriangleIcon} title="Triangle" />
                                        <ToolButton isActive={canvasState.mode === "inserting" && canvasState.layerType === "Arrow"} onClick={() => { setCanvasState({ mode: "inserting", layerType: "Arrow" }); setShowShapesMenu(false); }} icon={MoveRight} title="Flèche" />
                                        <ToolButton isActive={canvasState.mode === "inserting" && canvasState.layerType === "Diamond"} onClick={() => { setCanvasState({ mode: "inserting", layerType: "Diamond" }); setShowShapesMenu(false); }} icon={Diamond} title="Losange" />
                                        <ToolButton isActive={canvasState.mode === "inserting" && canvasState.layerType === "Star"} onClick={() => { setCanvasState({ mode: "inserting", layerType: "Star" }); setShowShapesMenu(false); }} icon={Star} title="Étoile" />
                                    </motion.div>
                                )}
                            </div>

                            <ToolButton isActive={canvasState.mode === "inserting" && canvasState.layerType === "Note"} onClick={() => { setCanvasState({ mode: "inserting", layerType: "Note" }); setShowShapesMenu(false); setShowLayersPanel(false); }} icon={StickyNote} title="Note" />
                            <ToolButton isActive={canvasState.mode === "inserting" && canvasState.layerType === "Text"} onClick={() => { setCanvasState({ mode: "inserting", layerType: "Text" }); setShowShapesMenu(false); setShowLayersPanel(false); }} icon={Type} title="Texte" />
                            <ToolButton isActive={canvasState.mode === "pencil" && pencilTool === "draw"} onClick={() => { setCanvasState({ mode: "pencil" }); setPencilTool("draw"); setShowShapesMenu(false); setShowLayersPanel(false); }} icon={Pencil} title="Crayon" />
                            <ToolButton isActive={canvasState.mode === "pencil" && pencilTool === "erase"} onClick={() => { setCanvasState({ mode: "pencil" }); setPencilTool("erase"); setShowShapesMenu(false); setShowLayersPanel(false); }} icon={Eraser} title="Gomme" />

                            <div className="relative">
                                <ToolButton isActive={showLayersPanel} onClick={() => { setShowLayersPanel(!showLayersPanel); setShowShapesMenu(false); }} icon={Layers} title="Liste des calques" />
                                {showLayersPanel && <LayersPanel />}
                            </div>
                            
                            <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg" onClick={() => { fileInputRef.current?.click(); setShowShapesMenu(false); setShowLayersPanel(false); }} title="Image"><ImageIcon className="h-4 w-4" /></Button>
                            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                            
                            <div className="h-[1px] bg-neutral-200 dark:bg-neutral-700 my-0.5 w-full" />
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg" onClick={() => history.undo()} disabled={!canUndo} title="Annuler"><Undo className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg" onClick={() => history.redo()} disabled={!canRedo} title="Rétablir"><Redo className="h-3.5 w-3.5" /></Button>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="h-[1px] bg-neutral-200 dark:bg-neutral-700 my-0.5 w-full" />
                <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    title={isCollapsed ? "Développer" : "Réduire"}
                    className="h-8 w-8 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg"
                >
                    <motion.div
                        animate={{ rotate: isCollapsed ? 180 : 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </motion.div>
                </Button>
            </div>
        </motion.div>
    )
}

function ToolButton({ isActive, onClick, icon: Icon, title }: { isActive: boolean, onClick: () => void, icon: any, title: string }) {
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
    )
}
