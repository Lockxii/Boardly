"use client";

import { useMutation, useSelf, useStorage } from "@/liveblocks.config";
import { memo } from "react";
import { Trash2, AlignLeft, AlignCenter, AlignRight, AlignVerticalJustifyCenter, AlignVerticalJustifyStart, AlignVerticalJustifyEnd, Bold, Italic, Underline, Ban } from "lucide-react";
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
    
    const selectionInfo = useStorage((root) => {
        const layers = root.layers;
        if (!selection || selection.length === 0) return { hasText: false, onlyText: false, hasImage: false, allImages: false, fontSize: 16, fontFamily: "font-sans", isBold: false, isItalic: false, isUnderline: false };

        let textCount = 0;
        let imageCount = 0;
        let otherCount = 0;
        let hasNoteOrText = false;
        let fontSize = 16;
        let fontFamily = "font-sans";
        let isBold = false;
        let isItalic = false;
        let isUnderline = false;

        selection?.forEach(id => {
            const layer = layers.get(id);
            if (!layer) return;

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
            isUnderline
        };
    });

    const hasTextLayer = selectionInfo?.hasText;
    const showFill = !selectionInfo?.onlyText && !selectionInfo?.allImages;
    const currentFontSize = selectionInfo?.fontSize || 16;
    const currentFontFamily = selectionInfo?.fontFamily || "font-sans";
    const isBold = selectionInfo?.isBold || false;
    const isItalic = selectionInfo?.isItalic || false;
    const isUnderline = selectionInfo?.isUnderline || false;

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

    const setTextColor = useMutation(({ storage }, color: string) => {
        const liveLayers = storage.get("layers");
        selection?.forEach(id => { liveLayers.get(id)?.update({ textColor: color }); });
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

    const toggleBold = useMutation(({ storage }) => {
        const liveLayers = storage.get("layers");
        selection?.forEach(id => {
            const layer = liveLayers.get(id);
            if (layer) layer.update({ fontWeight: layer.get("fontWeight") === "bold" ? "normal" : "bold" });
        });
    }, [selection]);

    const toggleItalic = useMutation(({ storage }) => {
        const liveLayers = storage.get("layers");
        selection?.forEach(id => {
            const layer = liveLayers.get(id);
            if (layer) layer.update({ fontStyle: layer.get("fontStyle") === "italic" ? "normal" : "italic" });
        });
    }, [selection]);

    const toggleUnderline = useMutation(({ storage }) => {
        const liveLayers = storage.get("layers");
        selection?.forEach(id => {
            const layer = liveLayers.get(id);
            if (layer) layer.update({ textDecoration: layer.get("textDecoration") === "underline" ? "none" : "underline" });
        });
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
        <div className="absolute top-20 right-4 md:right-auto md:left-1/2 md:-translate-x-1/2 flex flex-row items-center gap-2 p-2 bg-white dark:bg-neutral-800 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-700 pointer-events-auto overflow-x-auto max-w-[95vw] no-scrollbar" onMouseDown={preventFocusLoss}>
            {showFill && (
                <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] uppercase font-bold text-neutral-500">Fond</span>
                    <div className="flex items-center gap-1.5">
                        <div className="relative overflow-hidden rounded-full border border-neutral-300 w-6 h-6 shadow-sm hover:scale-110 transition">
                            <input type="color" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] p-0 cursor-pointer border-none" onChange={(e) => setFill(e.target.value)} onMouseDown={preventFocusLoss} title="Couleur de fond" />
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full border border-neutral-300 bg-white" onClick={() => setFill("transparent")} title="Aucun remplissage">
                            <Ban className="h-3 w-3 text-red-500" />
                        </Button>
                    </div>
                    <div className="w-[1px] h-6 bg-neutral-200 dark:bg-neutral-700 mx-1" />
                </div>
            )}

            {showFill && (
                <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] uppercase font-bold text-neutral-500">Contour</span>
                    <div className="flex items-center gap-1.5">
                        <div className="relative overflow-hidden rounded-full border border-neutral-300 w-6 h-6 shadow-sm hover:scale-110 transition">
                            <input type="color" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] p-0 cursor-pointer border-none" onChange={(e) => setStroke(e.target.value)} onMouseDown={preventFocusLoss} title="Couleur de bordure" />
                        </div>
                        <input type="range" min="0" max="20" className="w-12 h-1 bg-neutral-200 rounded-lg appearance-none cursor-pointer dark:bg-neutral-700" onChange={(e) => setStrokeWidth(parseInt(e.target.value))} onMouseDown={(e) => e.stopPropagation()} title="Épaisseur" />
                    </div>
                    <div className="w-[1px] h-6 bg-neutral-200 dark:bg-neutral-700 mx-1" />
                </div>
            )}

            {(showFill || selectionInfo?.hasImage || selectionInfo?.hasText) && (
                <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] uppercase font-bold text-neutral-500">Angles</span>
                    <input type="range" min="0" max="100" className="w-16 h-1 bg-neutral-200 rounded-lg appearance-none cursor-pointer dark:bg-neutral-700" onChange={(e) => setCornerRadius(parseInt(e.target.value))} onMouseDown={(e) => e.stopPropagation()} title="Arrondi" />
                    <div className="w-[1px] h-6 bg-neutral-200 dark:bg-neutral-700 mx-1" />
                </div>
            )}

            {hasTextLayer && (
                <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-bold text-neutral-500">Texte</span>
                        <div className="relative overflow-hidden rounded-full border border-neutral-300 w-6 h-6 shadow-sm hover:scale-110 transition">
                            <input type="color" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] p-0 cursor-pointer border-none" onChange={(e) => setTextColor(e.target.value)} onMouseDown={preventFocusLoss} title="Couleur texte" />
                        </div>
                    </div>
                    <div className="w-[1px] h-6 bg-neutral-200 dark:bg-neutral-700 mx-1" />
                    <Select value={currentFontFamily} onValueChange={setFontFamily}>
                        <SelectTrigger className="w-[80px] h-7 text-[10px] border-none bg-neutral-100 focus:ring-0 px-1"><SelectValue placeholder="Police" /></SelectTrigger>
                        <SelectContent>{FONTS.map(f => (<SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>))}</SelectContent>
                    </Select>
                    <Input type="number" className="w-[50px] h-7 text-[10px] border-none bg-neutral-100 focus:ring-0 px-0 text-center" value={currentFontSize} onChange={(e) => setFontSize(Number(e.target.value))} min={8} max={200} onMouseDown={(e) => e.stopPropagation()} title="Taille" />
                    <div className="w-[1px] h-6 bg-neutral-200 dark:bg-neutral-700 mx-1" />
                    <div className="flex bg-neutral-100 dark:bg-neutral-900 rounded-md p-0.5">
                        <Button variant="ghost" size="icon" className={`h-6 w-6 rounded-sm hover:bg-white ${isBold ? "bg-neutral-200 dark:bg-neutral-700" : ""}`} onClick={() => toggleBold()} onMouseDown={preventFocusLoss} title="Gras"><Bold className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" className={`h-6 w-6 rounded-sm hover:bg-white ${isItalic ? "bg-neutral-200 dark:bg-neutral-700" : ""}`} onClick={() => toggleItalic()} onMouseDown={preventFocusLoss} title="Italique"><Italic className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" className={`h-6 w-6 rounded-sm hover:bg-white ${isUnderline ? "bg-neutral-200 dark:bg-neutral-700" : ""}`} onClick={() => toggleUnderline()} onMouseDown={preventFocusLoss} title="Souligné"><Underline className="h-3 w-3" /></Button>
                    </div>
                    <div className="w-[1px] h-6 bg-neutral-200 dark:bg-neutral-700 mx-1" />
                    <div className="flex bg-neutral-100 dark:bg-neutral-900 rounded-md p-0.5">
                        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm hover:bg-white" onClick={() => setAlignX("left")} onMouseDown={preventFocusLoss} title="Gauche"><AlignLeft className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm hover:bg-white" onClick={() => setAlignX("center")} onMouseDown={preventFocusLoss} title="Centre"><AlignCenter className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm hover:bg-white" onClick={() => setAlignX("right")} onMouseDown={preventFocusLoss} title="Droite"><AlignRight className="h-3 w-3" /></Button>
                    </div>
                    <div className="flex bg-neutral-100 dark:bg-neutral-900 rounded-md p-0.5 ml-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm hover:bg-white" onClick={() => setAlignY("top")} onMouseDown={preventFocusLoss} title="Haut"><AlignVerticalJustifyStart className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm hover:bg-white" onClick={() => setAlignY("center")} onMouseDown={preventFocusLoss} title="Milieu"><AlignVerticalJustifyCenter className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm hover:bg-white" onClick={() => setAlignY("bottom")} onMouseDown={preventFocusLoss} title="Bas"><AlignVerticalJustifyEnd className="h-3 w-3" /></Button>
                    </div>
                </div>
            )}

            <div className="w-[1px] h-6 bg-neutral-200 dark:bg-neutral-700 hidden md:block mx-1" />
            <Button variant="ghost" size="icon" onClick={deleteLayers} title="Supprimer" className="h-8 w-8 hover:bg-red-100 hover:text-red-600 shrink-0 ml-auto"><Trash2 className="h-4 w-4" /></Button>
        </div>
    );
});

SelectionTools.displayName = "SelectionTools";
