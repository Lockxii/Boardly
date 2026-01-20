"use client";

import { useMutation, useSelf, useStorage } from "@/liveblocks.config";
import { memo, useState, useEffect, useRef } from "react";
import { Trash2, AlignLeft, AlignCenter, AlignRight, AlignVerticalJustifyCenter, AlignVerticalJustifyStart, AlignVerticalJustifyEnd, Bold, Italic, Underline, Ban, Copy, Lock, Unlock, Highlighter, Palette, Type, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { nanoid } from "nanoid";
import { LiveObject } from "@liveblocks/client";
import { Layer } from "@/liveblocks.config";

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
    
    const selectionInfo = useStorage((root) => {
        const layers = root.layers;
        if (!selection || selection.length === 0) return { hasText: false, onlyText: false, hasImage: false, allImages: false, fontSize: 16, fontFamily: "font-sans", isBold: false, isItalic: false, isUnderline: false, isLocked: false };

        let textCount = 0;
        let imageCount = 0;
        let otherCount = 0;
        let hasNoteOrText = false;
        let fontSize = 16;
        let fontFamily = "font-sans";
        let isBold = false;
        let isItalic = false;
        let isUnderline = false;
        let isLocked = true;
        let stroke = "#000000";
        let strokeWidth = 0;
        let cornerRadius = 0;
        let fill = "transparent";

        selection?.forEach(id => {
            const layer = layers.get(id);
            if (!layer) return;

            if (!layer.locked) isLocked = false;

            const isShape = ["Rectangle", "Ellipse", "Triangle", "Star", "Diamond", "Arrow"].includes(layer.type);
            const isTextual = ["Text", "Note"].includes(layer.type);
            const isImage = layer.type === "Image";

            if (isImage) imageCount++;

            if (isShape || isTextual) {
                hasNoteOrText = true; 
                if (layer.fontSize) fontSize = layer.fontSize;
                if (layer.fontFamily) fontFamily = layer.fontFamily;
                if (layer.fontWeight === "bold") isBold = true;
                if (layer.fontStyle === "italic") isItalic = true;
                if (layer.textDecoration === "underline") isUnderline = true;
                
                if (layer.stroke) stroke = layer.stroke;
                if (layer.strokeWidth !== undefined) strokeWidth = layer.strokeWidth;
                if (layer.cornerRadius !== undefined) cornerRadius = layer.cornerRadius;
                if (layer.fill) fill = layer.fill;

                if (layer.type === "Text") textCount++;
                else otherCount++;
            } else if (!isImage) {
                otherCount++;
            }
        });

        return {
            hasText: hasNoteOrText,
            onlyText: textCount > 0 && (otherCount + imageCount) === 0,
            hasImage: imageCount > 0,
            allImages: imageCount > 0 && (otherCount + textCount) === 0 && !hasNoteOrText,
            fontSize,
            fontFamily,
            isBold,
            isItalic,
            isUnderline,
            isLocked,
            stroke,
            strokeWidth,
            cornerRadius,
            fill
        };
    });

    const isLocked = selectionInfo?.isLocked || false;
    const hasTextLayer = selectionInfo?.hasText;
    const showFill = !selectionInfo?.onlyText && !selectionInfo?.allImages;
    const currentFontSize = selectionInfo?.fontSize || 16;
    const currentFontFamily = selectionInfo?.fontFamily || "font-sans";
    const isBold = selectionInfo?.isBold || false;
    const isItalic = selectionInfo?.isItalic || false;
    const isUnderline = selectionInfo?.isUnderline || false;
    const currentStroke = selectionInfo?.stroke || "#000000";
    const currentStrokeWidth = selectionInfo?.strokeWidth || 0;
    const currentCornerRadius = selectionInfo?.cornerRadius || 0;
    const currentFill = selectionInfo?.fill || "transparent";

    // Local state for smooth slider interaction
    const [localStrokeWidth, setLocalStrokeWidth] = useState(currentStrokeWidth);
    const [localCornerRadius, setLocalCornerRadius] = useState(currentCornerRadius);
    const [isDraggingSlider, setIsDraggingSlider] = useState(false);
    
    // Selection preservation
    const lastSelectionRange = useRef<Range | null>(null);

    useEffect(() => {
        const handleSelectionChange = () => {
            const selection = window.getSelection();
            if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const container = range.commonAncestorContainer;
                const node = container.nodeType === 3 ? container.parentElement : container as HTMLElement;
                if (node?.closest('[contenteditable="true"]')) {
                    lastSelectionRange.current = range.cloneRange();
                }
            }
        };

        document.addEventListener("selectionchange", handleSelectionChange);
        return () => document.removeEventListener("selectionchange", handleSelectionChange);
    }, []);

    useEffect(() => {
        if (!isDraggingSlider) {
            setLocalStrokeWidth(currentStrokeWidth);
        }
    }, [currentStrokeWidth, isDraggingSlider]);

    useEffect(() => {
        if (!isDraggingSlider) {
            setLocalCornerRadius(currentCornerRadius);
        }
    }, [currentCornerRadius, isDraggingSlider]);

    const setFill = useMutation(({ storage }, fill: string) => {
        const liveLayers = storage.get("layers");
        selection?.forEach(id => { liveLayers.get(id)?.update({ fill }); });
    }, [selection]);

    const setStroke = useMutation(({ storage }, stroke: string) => {
        const liveLayers = storage.get("layers");
        selection?.forEach(id => { liveLayers.get(id)?.update({ stroke }); });
    }, [selection]);

    const setStrokeWidth = useMutation(({ storage }, width: number) => {
        const liveLayers = storage.get("layers");
        selection?.forEach(id => { liveLayers.get(id)?.update({ strokeWidth: width }); });
    }, [selection]);

    const handleStrokeWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseInt(e.target.value);
        setLocalStrokeWidth(val);
        setStrokeWidth(val);
    };

    const applyDomStyle = (command: string, value?: string) => {
        if (typeof window === "undefined") return false;
        
        let selection = window.getSelection();
        
        // Try to restore if selection is invalid/collapsed but we have a saved range
        if ((!selection || selection.isCollapsed) && lastSelectionRange.current) {
            selection?.removeAllRanges();
            selection?.addRange(lastSelectionRange.current);
            selection = window.getSelection(); // Refresh
        }

        if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
             const anchor = selection.anchorNode?.parentElement;
             const focus = selection.focusNode?.parentElement;
             // Ensure we are inside a contentEditable (basic check)
             if ((anchor && anchor.isContentEditable) || (focus && focus.isContentEditable) || (selection.anchorNode && (selection.anchorNode as HTMLElement).isContentEditable)) {
                 document.execCommand("styleWithCSS", false, "true");
                 document.execCommand(command, false, value);
                 
                 // Update the stored range because execCommand might change it
                 if (selection.rangeCount > 0) {
                     lastSelectionRange.current = selection.getRangeAt(0).cloneRange();
                 }
                 return true;
             }
        }
        return false;
    };

    const setTextColor = useMutation(({ storage }, color: string) => {
        if (applyDomStyle("foreColor", color)) return;
        const liveLayers = storage.get("layers");
        selection?.forEach(id => { liveLayers.get(id)?.update({ textColor: color }); });
    }, [selection]);
    
    const setTextBackground = useMutation(({ storage }, color: string) => {
        if (applyDomStyle("hiliteColor", color)) return;
        const liveLayers = storage.get("layers");
        selection?.forEach(id => { liveLayers.get(id)?.update({ textBackground: color }); });
    }, [selection]);

    const setAlignX = useMutation(({ storage }, align: "left" | "center" | "right") => {
        const liveLayers = storage.get("layers");
        selection?.forEach(id => { liveLayers.get(id)?.update({ alignX: align }); });
    }, [selection]);

    const setAlignY = useMutation(({ storage }, align: "top" | "center" | "bottom") => {
        const liveLayers = storage.get("layers");
        selection?.forEach(id => { liveLayers.get(id)?.update({ alignY: align }); });
    }, [selection]);

    const setFontFamily = useMutation(({ storage }, font: string) => {
        const liveLayers = storage.get("layers");
        selection?.forEach(id => { liveLayers.get(id)?.update({ fontFamily: font }); });
    }, [selection]);

    const setFontSize = useMutation(({ storage }, size: number) => {
        const liveLayers = storage.get("layers");
        selection?.forEach(id => { liveLayers.get(id)?.update({ fontSize: size }); });
    }, [selection]);

    const setCornerRadius = useMutation(({ storage }, radius: number) => {
        const liveLayers = storage.get("layers");
        selection?.forEach(id => { liveLayers.get(id)?.update({ cornerRadius: radius }); });
    }, [selection]);

    const handleCornerRadiusChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseInt(e.target.value);
        setLocalCornerRadius(val);
        setCornerRadius(val);
    };

    const toggleBold = useMutation(({ storage }) => {
        if (applyDomStyle("bold")) return;
        const liveLayers = storage.get("layers");
        selection?.forEach(id => {
            const layer = liveLayers.get(id);
            if (layer) layer.update({ fontWeight: layer.get("fontWeight") === "bold" ? "normal" : "bold" });
        });
    }, [selection]);

    const toggleItalic = useMutation(({ storage }) => {
        if (applyDomStyle("italic")) return;
        const liveLayers = storage.get("layers");
        selection?.forEach(id => {
            const layer = liveLayers.get(id);
            if (layer) layer.update({ fontStyle: layer.get("fontStyle") === "italic" ? "normal" : "italic" });
        });
    }, [selection]);

    const toggleUnderline = useMutation(({ storage }) => {
        if (applyDomStyle("underline")) return;
        const liveLayers = storage.get("layers");
        selection?.forEach(id => {
            const layer = liveLayers.get(id);
            if (layer) layer.update({ textDecoration: layer.get("textDecoration") === "underline" ? "none" : "underline" });
        });
    }, [selection]);

    const toggleLock = useMutation(({ storage }) => {
        const liveLayers = storage.get("layers");
        selection?.forEach(id => {
            const layer = liveLayers.get(id);
            if (layer) layer.update({ locked: !layer.get("locked") });
        });
    }, [selection]);

    const duplicateLayers = useMutation(({ storage, setMyPresence }) => {
        const liveLayers = storage.get("layers");
        const liveLayerIds = storage.get("layerIds");
        const newSelection: string[] = [];
        selection?.forEach(id => {
            const layer = liveLayers.get(id);
            if (!layer) return;
            const layerId = nanoid();
            const layerData = layer.toObject();
            const newLayer = new LiveObject<Layer>({ ...layerData, x: layerData.x + 20, y: layerData.y + 20, locked: false });
            liveLayers.set(layerId, newLayer);
            liveLayerIds.push(layerId);
            newSelection.push(layerId);
        });
        setMyPresence({ selection: newSelection }, { addToHistory: true });
    }, [selection]);

    const deleteLayers = useMutation(({ storage, setMyPresence }) => {
        const liveLayers = storage.get("layers");
        const liveLayerIds = storage.get("layerIds");
        selection?.forEach(id => {
            liveLayers.delete(id);
            const index = liveLayerIds.indexOf(id);
            if (index !== -1) liveLayerIds.delete(index);
        });
        setMyPresence({ selection: [] }, { addToHistory: true });
    }, [selection]);

    if (!selection || selection.length === 0) return null;

    const preventFocusLoss = (e: React.MouseEvent) => { e.preventDefault(); };

    return (
        <div className="absolute top-22 right-4 md:right-auto md:left-1/2 md:-translate-x-1/2 flex flex-row items-center gap-1 p-1 bg-white dark:bg-neutral-800 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-700 pointer-events-auto overflow-hidden no-scrollbar transition-all z-50" onMouseDown={preventFocusLoss}>
            
            {/* Drag Handle */}
            <div className="px-1 cursor-grab text-neutral-300 dark:text-neutral-600"><GripVertical className="h-4 w-4" /></div>

            {!isLocked && (
                <>
                    {/* Style Group */}
                    {showFill && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-md" title="Style & Apparence">
                                    <Palette className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-64 p-3 select-none" align="start" sideOffset={10}>
                                <DropdownMenuLabel className="mb-2">Apparence</DropdownMenuLabel>
                                
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center text-xs text-neutral-500 font-medium">
                                            <span>Remplissage</span>
                                            <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-red-50 text-neutral-400 hover:text-red-500 rounded-full" onClick={() => setFill("transparent")} title="Aucun">
                                                <Ban className="h-3 w-3" />
                                            </Button>
                                        </div>
                                        <div className="flex gap-2 items-center">
                                            <input type="color" value={currentFill} className="h-8 w-full cursor-pointer rounded border border-neutral-200" onChange={(e) => setFill(e.target.value)} />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center text-xs text-neutral-500 font-medium">
                                            <span>Contour</span>
                                        </div>
                                        <div className="flex gap-2 items-center">
                                            <input type="color" value={currentStroke} className="h-8 w-10 shrink-0 cursor-pointer rounded border border-neutral-200" onChange={(e) => setStroke(e.target.value)} />
                                            <input 
                                                type="range" 
                                                min="0" 
                                                max="20" 
                                                value={localStrokeWidth} 
                                                className="flex-1 h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer" 
                                                onPointerDown={(e) => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); setIsDraggingSlider(true); }} 
                                                onPointerUp={(e) => { e.stopPropagation(); e.currentTarget.releasePointerCapture(e.pointerId); setIsDraggingSlider(false); }} 
                                                onMouseDown={(e) => e.stopPropagation()}
                                                onChange={handleStrokeWidthChange} 
                                            />
                                        </div>
                                    </div>

                                    {(showFill || selectionInfo?.hasImage || hasTextLayer) && (
                                        <div className="space-y-2">
                                            <div className="text-xs text-neutral-500 font-medium">Arrondi</div>
                                            <input 
                                                type="range" 
                                                min="0" 
                                                max="100" 
                                                value={localCornerRadius} 
                                                className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer" 
                                                onPointerDown={(e) => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); setIsDraggingSlider(true); }} 
                                                onPointerUp={(e) => { e.stopPropagation(); e.currentTarget.releasePointerCapture(e.pointerId); setIsDraggingSlider(false); }} 
                                                onMouseDown={(e) => e.stopPropagation()}
                                                onChange={handleCornerRadiusChange} 
                                            />
                                        </div>
                                    )}
                                </div>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}

                    {/* Text Group */}
                    {hasTextLayer && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-md" title="Texte & Format">
                                    <Type className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-72 p-3" align="start" sideOffset={10}>
                                <DropdownMenuLabel className="mb-2">Format du texte</DropdownMenuLabel>
                                
                                <div className="space-y-4">
                                    <div className="flex gap-2">
                                        <Select value={currentFontFamily} onValueChange={setFontFamily}>
                                            <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Police" /></SelectTrigger>
                                            <SelectContent>{FONTS.map(f => (<SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>))}</SelectContent>
                                        </Select>
                                        <div className="flex items-center gap-1 border border-neutral-200 rounded px-2 w-20">
                                            <span className="text-[10px] text-neutral-500">px</span>
                                            <Input type="number" className="h-8 text-xs border-none p-0 focus-visible:ring-0 text-right" value={currentFontSize} onChange={(e) => setFontSize(Number(e.target.value))} min={8} max={200} />
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between gap-1 bg-neutral-100 dark:bg-neutral-900 p-1 rounded-md">
                                        <div className="flex gap-0.5">
                                            <Button variant="ghost" size="icon" className={`h-7 w-7 rounded-sm ${isBold ? "bg-white shadow-sm" : ""}`} onClick={() => toggleBold()}><Bold className="h-3.5 w-3.5" /></Button>
                                            <Button variant="ghost" size="icon" className={`h-7 w-7 rounded-sm ${isItalic ? "bg-white shadow-sm" : ""}`} onClick={() => toggleItalic()}><Italic className="h-3.5 w-3.5" /></Button>
                                            <Button variant="ghost" size="icon" className={`h-7 w-7 rounded-sm ${isUnderline ? "bg-white shadow-sm" : ""}`} onClick={() => toggleUnderline()}><Underline className="h-3.5 w-3.5" /></Button>
                                        </div>
                                        <div className="w-[1px] h-4 bg-neutral-300 dark:bg-neutral-700" />
                                        <div className="flex gap-0.5">
                                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm" onClick={() => setAlignX("left")}><AlignLeft className="h-3.5 w-3.5" /></Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm" onClick={() => setAlignX("center")}><AlignCenter className="h-3.5 w-3.5" /></Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm" onClick={() => setAlignX("right")}><AlignRight className="h-3.5 w-3.5" /></Button>
                                        </div>
                                        <div className="w-[1px] h-4 bg-neutral-300 dark:bg-neutral-700" />
                                        <div className="flex gap-0.5">
                                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm" onClick={() => setAlignY("top")}><AlignVerticalJustifyStart className="h-3.5 w-3.5" /></Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm" onClick={() => setAlignY("center")}><AlignVerticalJustifyCenter className="h-3.5 w-3.5" /></Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm" onClick={() => setAlignY("bottom")}><AlignVerticalJustifyEnd className="h-3.5 w-3.5" /></Button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <span className="text-[10px] uppercase font-bold text-neutral-500">Couleur</span>
                                            <div className="h-8 w-full rounded border border-neutral-200 relative overflow-hidden">
                                                <input type="color" className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" onChange={(e) => setTextColor(e.target.value)} />
                                                <div className="w-full h-full" style={{ backgroundColor: 'currentColor' }} /> 
                                                {/* Visual fix: we can't easily show the current color without reading from selection, assuming black default */}
                                                <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-xs font-mono">Aa</div>
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] uppercase font-bold text-neutral-500">Surlignage</span>
                                                <Button variant="ghost" size="icon" className="h-4 w-4 text-neutral-400 hover:text-red-500 p-0" onClick={() => setTextBackground("transparent")}><Ban className="h-3 w-3" /></Button>
                                            </div>
                                            <div className="h-8 w-full rounded border border-neutral-200 relative overflow-hidden bg-yellow-100 flex items-center justify-center">
                                                <input type="color" className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" onChange={(e) => setTextBackground(e.target.value)} />
                                                <Highlighter className="h-4 w-4 text-neutral-600 pointer-events-none" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                    
                    <div className="w-[1px] h-6 bg-neutral-200 dark:bg-neutral-700 mx-1" />
                </>
            )}

            <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={toggleLock} title={isLocked ? "Déverrouiller" : "Verrouiller"} className={`h-8 w-8 hover:bg-neutral-100 shrink-0 ${isLocked ? "text-red-500 bg-red-50 hover:bg-red-100" : ""}`}>
                    {isLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                </Button>
                {!isLocked && (
                    <Button variant="ghost" size="icon" onClick={duplicateLayers} title="Dupliquer (Cmd+D)" className="h-8 w-8 hover:bg-neutral-100 shrink-0">
                        <Copy className="h-4 w-4" />
                    </Button>
                )}
                <Button variant="ghost" size="icon" onClick={deleteLayers} title="Supprimer" className="h-8 w-8 hover:bg-red-100 hover:text-red-600 shrink-0"><Trash2 className="h-4 w-4" /></Button>
            </div>
        </div>
    );
});

SelectionTools.displayName = "SelectionTools";