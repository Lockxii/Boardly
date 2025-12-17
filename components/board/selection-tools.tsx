"use client";

import { useMutation, useSelf, useStorage } from "@/liveblocks.config";
import { memo } from "react";
import { Trash2, AlignLeft, AlignCenter, AlignRight, AlignVerticalJustifyCenter, AlignVerticalJustifyStart, AlignVerticalJustifyEnd } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface SelectionToolsProps {
    camera: { x: number, y: number, zoom: number };
}

const FONTS = [
    { value: "font-sans", label: "Sans" },
    { value: "font-serif", label: "Serif" },
    { value: "font-mono", label: "Mono" },
    { value: "font-handwriting", label: "Manuscrit" },
];

export const SelectionTools = memo(({ camera }: SelectionToolsProps) => {
    const selection = useSelf((me) => me.presence.selection);
    
    // Check selection types
    const selectionInfo = useStorage((root) => {
        const layers = root.layers;
        if (!selection || selection.length === 0) return { hasText: false, onlyText: false, fontSize: 16, fontFamily: "font-sans" };

        let textCount = 0;
        let otherCount = 0;
        let hasNoteOrText = false;
        let fontSize = 16;
        let fontFamily = "font-sans";

        selection.forEach(id => {
            const layer = layers.get(id);
            if (!layer) return;

            if (layer.type === "Text" || layer.type === "Note" || layer.type === "Rectangle" || layer.type === "Ellipse") {
                hasNoteOrText = true;
                if (layer.fontSize) fontSize = layer.fontSize;
                if (layer.fontFamily) fontFamily = layer.fontFamily;
                
                if (layer.type === "Text") textCount++;
                else otherCount++;
            } else {
                otherCount++;
            }
        });

        return {
            hasText: hasNoteOrText,
            onlyText: textCount > 0 && otherCount === 0,
            fontSize,
            fontFamily
        };
    });

    const hasTextLayer = selectionInfo?.hasText;
    const showFill = !selectionInfo?.onlyText;
    const currentFontSize = selectionInfo?.fontSize || 16;
    const currentFontFamily = selectionInfo?.fontFamily || "font-sans";

    // Mutations
    const setFill = useMutation(({ storage }, fill: string) => {
        const liveLayers = storage.get("layers");
        selection.forEach(id => {
            liveLayers.get(id)?.update({ fill });
        })
    }, [selection]);

    const setTextColor = useMutation(({ storage }, color: string) => {
        const liveLayers = storage.get("layers");
        selection.forEach(id => {
            liveLayers.get(id)?.update({ textColor: color });
        })
    }, [selection]);

    const setAlignX = useMutation(({ storage }, align: "left" | "center" | "right") => {
        const liveLayers = storage.get("layers");
        selection.forEach(id => {
            liveLayers.get(id)?.update({ alignX: align });
        })
    }, [selection]);

    const setAlignY = useMutation(({ storage }, align: "top" | "center" | "bottom") => {
        const liveLayers = storage.get("layers");
        selection.forEach(id => {
            liveLayers.get(id)?.update({ alignY: align });
        })
    }, [selection]);

    const setFontFamily = useMutation(({ storage }, font: string) => {
        const liveLayers = storage.get("layers");
        selection.forEach(id => {
            liveLayers.get(id)?.update({ fontFamily: font });
        })
    }, [selection]);

    const setFontSize = useMutation(({ storage }, size: number) => {
        const liveLayers = storage.get("layers");
        selection.forEach(id => {
            liveLayers.get(id)?.update({ fontSize: size });
        })
    }, [selection]);

    const deleteLayers = useMutation(({ storage, setMyPresence }) => {
        const liveLayers = storage.get("layers");
        const liveLayerIds = storage.get("layerIds");
        
        selection.forEach(id => {
            liveLayers.delete(id);
            const index = liveLayerIds.indexOf(id);
            if (index !== -1) liveLayerIds.delete(index);
        });
        
        setMyPresence({ selection: [] }, { addToHistory: true });
    }, [selection]);

    if (!selection || selection.length === 0) return null;

    // Helper to prevent focus loss
    const preventFocusLoss = (e: React.MouseEvent) => {
        e.preventDefault();
    };

    return (
        <div 
            className="absolute top-4 right-4 md:right-auto md:left-1/2 md:-translate-x-1/2 flex flex-row items-center gap-2 p-2 bg-white dark:bg-neutral-800 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-700 pointer-events-auto overflow-x-auto max-w-[95vw] no-scrollbar"
            onMouseDown={preventFocusLoss}
        >
            
            {/* Fill Color Picker */}
            {showFill && (
                <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] uppercase font-bold text-neutral-500">Remplir</span>
                    <div className="relative overflow-hidden rounded-full border border-neutral-300 w-6 h-6 shadow-sm hover:scale-110 transition">
                        <input 
                            type="color" 
                            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] p-0 cursor-pointer border-none"
                            onChange={(e) => setFill(e.target.value)}
                            onMouseDown={preventFocusLoss}
                            title="Couleur de remplissage"
                        />
                    </div>
                    <div className="w-[1px] h-6 bg-neutral-200 dark:bg-neutral-700 mx-1" />
                </div>
            )}

            {/* Text Controls */}
            {hasTextLayer && (
                <div className="flex items-center gap-2 shrink-0">
                    {/* Text Color */}
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-bold text-neutral-500">Texte</span>
                        <div className="relative overflow-hidden rounded-full border border-neutral-300 w-6 h-6 shadow-sm hover:scale-110 transition">
                            <input 
                                type="color" 
                                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] p-0 cursor-pointer border-none"
                                onChange={(e) => setTextColor(e.target.value)}
                                onMouseDown={preventFocusLoss}
                                title="Couleur du texte"
                            />
                        </div>
                    </div>

                    <div className="w-[1px] h-6 bg-neutral-200 dark:bg-neutral-700 mx-1" />

                    {/* Font Family */}
                    <Select value={currentFontFamily} onValueChange={setFontFamily}>
                        <SelectTrigger className="w-[80px] h-7 text-[10px] border-none bg-neutral-100 focus:ring-0 px-1">
                            <SelectValue placeholder="Police" />
                        </SelectTrigger>
                        <SelectContent>
                            {FONTS.map(f => (
                                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Font Size */}
                    <Input 
                        type="number" 
                        className="w-[50px] h-7 text-[10px] border-none bg-neutral-100 focus:ring-0 px-0 text-center" 
                        value={currentFontSize} 
                        onChange={(e) => setFontSize(Number(e.target.value))}
                        min={8}
                        max={200}
                        onMouseDown={(e) => e.stopPropagation()}
                        title="Taille de police"
                    />

                    <div className="w-[1px] h-6 bg-neutral-200 dark:bg-neutral-700 mx-1" />

                    {/* Align X */}
                    <div className="flex bg-neutral-100 dark:bg-neutral-900 rounded-md p-0.5">
                        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm hover:bg-white" onClick={() => setAlignX("left")} onMouseDown={preventFocusLoss} title="Aligner à gauche">
                            <AlignLeft className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm hover:bg-white" onClick={() => setAlignX("center")} onMouseDown={preventFocusLoss} title="Centrer">
                            <AlignCenter className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm hover:bg-white" onClick={() => setAlignX("right")} onMouseDown={preventFocusLoss} title="Aligner à droite">
                            <AlignRight className="h-3 w-3" />
                        </Button>
                    </div>

                    {/* Align Y */}
                    <div className="flex bg-neutral-100 dark:bg-neutral-900 rounded-md p-0.5 ml-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm hover:bg-white" onClick={() => setAlignY("top")} onMouseDown={preventFocusLoss} title="Aligner en haut">
                            <AlignVerticalJustifyStart className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm hover:bg-white" onClick={() => setAlignY("center")} onMouseDown={preventFocusLoss} title="Aligner au milieu">
                            <AlignVerticalJustifyCenter className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm hover:bg-white" onClick={() => setAlignY("bottom")} onMouseDown={preventFocusLoss} title="Aligner en bas">
                            <AlignVerticalJustifyEnd className="h-3 w-3" />
                        </Button>
                    </div>
                </div>
            )}

            <div className="w-[1px] h-6 bg-neutral-200 dark:bg-neutral-700 hidden md:block mx-1" />

            {/* Delete Action */}
            <Button variant="ghost" size="icon" onClick={deleteLayers} title="Supprimer" className="h-8 w-8 hover:bg-red-100 hover:text-red-600 shrink-0 ml-auto">
                <Trash2 className="h-4 w-4" />
            </Button>
        </div>
    );
});

SelectionTools.displayName = "SelectionTools";