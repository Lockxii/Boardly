"use client";

import { useCanvasStore } from "@/store/use-canvas-store";
import { Layer, LayerType, useMutation } from "@/liveblocks.config";
import { MousePointer2, Square, Circle, Type, StickyNote, Redo, Undo, Image as ImageIcon, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCanRedo, useCanUndo, useHistory } from "@/liveblocks.config";
import { nanoid } from "nanoid";
import { LiveObject } from "@liveblocks/client";
import { useRef } from "react";

export function Toolbar() {
    const { canvasState, setCanvasState, camera } = useCanvasStore();
    const history = useHistory();
    const canUndo = useCanUndo();
    const canRedo = useCanRedo();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const insertImage = useMutation(({ storage, setMyPresence }, src: string) => {
        const liveLayers = storage.get("layers");
        const liveLayerIds = storage.get("layerIds");
        const layerId = nanoid();
        
        // Calculate center of screen based on camera
        const centerX = (window.innerWidth / 2 - camera.x) / camera.zoom;
        const centerY = (window.innerHeight / 2 - camera.y) / camera.zoom;

        const layer = new LiveObject<Layer>({
            type: "Image",
            x: centerX - 100, // Center the 200x200 image
            y: centerY - 100,
            height: 200,
            width: 200,
            fill: "",
            src: src
        });

        liveLayers.set(layerId, layer);
        liveLayerIds.push(layerId);

        setMyPresence({ selection: [layerId] }, { addToHistory: true });
    }, [camera]);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const src = event.target?.result as string;
            if (src) {
                insertImage(src);
            }
        };
        reader.readAsDataURL(file);
        
        e.target.value = "";
    };

    return (
        <div className="absolute top-1/2 left-4 -translate-y-1/2 flex flex-col gap-2 bg-white dark:bg-neutral-800 p-2 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-700 pointer-events-auto">
            <ToolButton 
                isActive={canvasState.mode === "none" || canvasState.mode === "translating" || canvasState.mode === "selectionNet" || canvasState.mode === "resizing"}
                onClick={() => setCanvasState({ mode: "none" })}
                icon={MousePointer2}
                title="Sélectionner"
            />
            <ToolButton 
                isActive={canvasState.mode === "inserting" && canvasState.layerType === "Rectangle"}
                onClick={() => setCanvasState({ mode: "inserting", layerType: "Rectangle" })}
                icon={Square}
                title="Rectangle"
            />
            <ToolButton 
                isActive={canvasState.mode === "inserting" && canvasState.layerType === "Ellipse"}
                onClick={() => setCanvasState({ mode: "inserting", layerType: "Ellipse" })}
                icon={Circle}
                title="Cercle"
            />
            <ToolButton 
                isActive={canvasState.mode === "inserting" && canvasState.layerType === "Note"}
                onClick={() => setCanvasState({ mode: "inserting", layerType: "Note" })}
                icon={StickyNote}
                title="Note"
            />
             <ToolButton 
                isActive={canvasState.mode === "inserting" && canvasState.layerType === "Text"}
                onClick={() => setCanvasState({ mode: "inserting", layerType: "Text" })}
                icon={Type}
                title="Texte"
            />
            <ToolButton 
                isActive={canvasState.mode === "pencil"}
                onClick={() => setCanvasState({ mode: "pencil" })}
                icon={Pencil}
                title="Crayon"
            />
            
            {/* Image Upload Button */}
            <Button 
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                title="Image"
            >
                <ImageIcon className="h-5 w-5" />
            </Button>
            <input 
                ref={fileInputRef}
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={handleImageUpload}
            />
            
            <div className="h-[1px] bg-neutral-200 dark:bg-neutral-700 my-1" />

            <Button variant="ghost" size="icon" onClick={() => history.undo()} disabled={!canUndo} title="Annuler">
                <Undo className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => history.redo()} disabled={!canRedo} title="Rétablir">
                <Redo className="h-4 w-4" />
            </Button>
        </div>
    )
}

function ToolButton({ isActive, onClick, icon: Icon, title }: { isActive: boolean, onClick: () => void, icon: any, title: string }) {
    return (
        <Button 
            variant={isActive ? "secondary" : "ghost"}
            size="icon"
            onClick={onClick}
            title={title}
            className={isActive ? "bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200" : ""}
        >
            <Icon className="h-5 w-5" />
        </Button>
    )
}
