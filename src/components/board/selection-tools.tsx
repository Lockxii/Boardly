import { memo, useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trash2, AlignLeft, AlignCenter, AlignRight,
  AlignVerticalJustifyCenter, AlignVerticalJustifyStart, AlignVerticalJustifyEnd,
  Bold, Italic, Underline, Ban, Copy, Lock, Unlock,
  Highlighter, Palette, Type, GripVertical,
  AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter,
  Group, Ungroup, ListChecks,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { useCanvasStore } from "@/store/canvas-store";
import { NOTE_COLORS } from "@/lib/canvas-utils";

interface SelectionToolsProps {
  camera: { x: number; y: number; zoom: number };
}

const FONTS = [
  { value: "font-sans", label: "Sans" },
  { value: "font-serif", label: "Serif" },
  { value: "font-mono", label: "Mono" },
  { value: "font-handwriting", label: "Manuscrit" },
];

export const SelectionTools = memo(({ camera }: SelectionToolsProps) => {
  const selection = useCanvasStore((s) => s.selection);
  const layers = useCanvasStore((s) => s.layers);
  const updateLayer = useCanvasStore((s) => s.updateLayer);
  const duplicateLayers = useCanvasStore((s) => s.duplicateLayers);
  const deleteLayers = useCanvasStore((s) => s.deleteLayers);
  const alignSelection = useCanvasStore((s) => s.alignSelection);
  const distributeSelection = useCanvasStore((s) => s.distributeSelection);
  const groupSelection = useCanvasStore((s) => s.groupSelection);
  const ungroupSelection = useCanvasStore((s) => s.ungroupSelection);
  const addChecklistItem = useCanvasStore((s) => s.addChecklistItem);
  const toggleReaction = useCanvasStore((s) => s.toggleReaction);
  const readOnly = useCanvasStore((s) => s.readOnly);
  const brandColors = useCanvasStore((s) => s.brandColors);
  const setBrandColors = useCanvasStore((s) => s.setBrandColors);

  const selectionInfo = useMemo(() => {
    if (!selection || selection.length === 0) return null;

    let textCount = 0, imageCount = 0, otherCount = 0;
    let hasNoteOrText = false;
    let hasNote = false;
    let fontSize = 16, fontFamily = "font-sans";
    let isBold = false, isItalic = false, isUnderline = false;
    let isLocked = true;
    let stroke = "#000000", strokeWidth = 0, cornerRadius = 0, fill = "transparent";

    selection.forEach((id: string) => {
      const layer = layers[id];
      if (!layer) return;
      if (!layer.locked) isLocked = false;
      const isShape = ["Rectangle", "Ellipse", "Triangle", "Star", "Diamond", "Arrow"].includes(layer.type);
      const isTextual = ["Text", "Note"].includes(layer.type);
      if (layer.type === "Image") imageCount++;
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
        else if (layer.type === "Note") { otherCount++; hasNote = true; }
        else otherCount++;
      } else if (layer.type !== "Image") otherCount++;
    });

    return {
      hasText: hasNoteOrText,
      hasNote,
      onlyText: textCount > 0 && (otherCount + imageCount) === 0,
      allImages: imageCount > 0 && (otherCount + textCount) === 0 && !hasNoteOrText,
      fontSize, fontFamily, isBold, isItalic, isUnderline, isLocked,
      stroke, strokeWidth, cornerRadius, fill,
    };
  }, [selection, layers]);

  const isLocked = selectionInfo?.isLocked || false;
  const hasTextLayer = selectionInfo?.hasText;
  const hasNoteLayer = selectionInfo?.hasNote;
  const multiSelect = selection.length >= 2;
  const canDistribute = selection.length >= 3;
  const REACTIONS = ["👍", "❤️", "🔥", "✅"];
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

  const [localStrokeWidth, setLocalStrokeWidth] = useState(currentStrokeWidth);
  const [localCornerRadius, setLocalCornerRadius] = useState(currentCornerRadius);
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);
  const lastSelectionRange = useRef<Range | null>(null);

  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const container = range.commonAncestorContainer;
        const node = container.nodeType === 3 ? container.parentElement : container as HTMLElement;
        if (node?.closest('[contenteditable="true"]')) lastSelectionRange.current = range.cloneRange();
      }
    };
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, []);

  useEffect(() => { if (!isDraggingSlider) setLocalStrokeWidth(currentStrokeWidth); }, [currentStrokeWidth, isDraggingSlider]);
  useEffect(() => { if (!isDraggingSlider) setLocalCornerRadius(currentCornerRadius); }, [currentCornerRadius, isDraggingSlider]);

  const applyToSelection = useCallback((updates: Record<string, unknown>) => {
    const state = useCanvasStore.getState();
    state.selection.forEach((id) => state.updateLayer(id, updates));
  }, []);

  const applyDomStyle = (command: string, value?: string) => {
    let sel = window.getSelection();
    if ((!sel || sel.isCollapsed) && lastSelectionRange.current) {
      sel?.removeAllRanges();
      sel?.addRange(lastSelectionRange.current);
      sel = window.getSelection();
    }
    if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
      const anchor = sel.anchorNode?.parentElement;
      if ((anchor && anchor.isContentEditable) || (sel.anchorNode && (sel.anchorNode as HTMLElement).isContentEditable)) {
        document.execCommand("styleWithCSS", false, "true");
        document.execCommand(command, false, value);
        if (sel.rangeCount > 0) lastSelectionRange.current = sel.getRangeAt(0).cloneRange();
        return true;
      }
    }
    return false;
  };

  const setFill = useCallback((fill: string) => applyToSelection({ fill }), [applyToSelection]);
  const setStroke = useCallback((stroke: string) => applyToSelection({ stroke }), [applyToSelection]);
  const setStrokeWidth = useCallback((width: number) => applyToSelection({ strokeWidth: width }), [applyToSelection]);
  const setCornerRadius = useCallback((radius: number) => applyToSelection({ cornerRadius: radius }), [applyToSelection]);

  const setTextColor = useCallback((color: string) => {
    if (applyDomStyle("foreColor", color)) return;
    applyToSelection({ textColor: color });
  }, [applyToSelection]);

  const setTextBackground = useCallback((color: string) => {
    if (applyDomStyle("hiliteColor", color)) return;
    applyToSelection({ textBackground: color });
  }, [applyToSelection]);

  const setAlignX = useCallback((align: "left" | "center" | "right") => applyToSelection({ alignX: align }), [applyToSelection]);
  const setAlignY = useCallback((align: "top" | "center" | "bottom") => applyToSelection({ alignY: align }), [applyToSelection]);
  const setFontFamily = useCallback((font: string) => applyToSelection({ fontFamily: font }), [applyToSelection]);
  const setFontSize = useCallback((size: number) => applyToSelection({ fontSize: size }), [applyToSelection]);

  const toggleBold = useCallback(() => {
    if (applyDomStyle("bold")) return;
    const state = useCanvasStore.getState();
    state.selection.forEach((id) => {
      const layer = state.layers[id];
      if (layer) state.updateLayer(id, { fontWeight: layer.fontWeight === "bold" ? "normal" : "bold" });
    });
  }, []);

  const toggleItalic = useCallback(() => {
    if (applyDomStyle("italic")) return;
    const state = useCanvasStore.getState();
    state.selection.forEach((id) => {
      const layer = state.layers[id];
      if (layer) state.updateLayer(id, { fontStyle: layer.fontStyle === "italic" ? "normal" : "italic" });
    });
  }, []);

  const toggleUnderline = useCallback(() => {
    if (applyDomStyle("underline")) return;
    const state = useCanvasStore.getState();
    state.selection.forEach((id) => {
      const layer = state.layers[id];
      if (layer) state.updateLayer(id, { textDecoration: layer.textDecoration === "underline" ? "none" : "underline" });
    });
  }, []);

  const toggleLock = useCallback(() => {
    const state = useCanvasStore.getState();
    state.selection.forEach((id) => {
      const layer = state.layers[id];
      if (layer) state.updateLayer(id, { locked: !layer.locked });
    });
  }, []);

  const preventFocusLoss = (e: React.MouseEvent) => e.preventDefault();

  return (
    <AnimatePresence>
      {selection && selection.length > 0 && (
    <motion.div
      key="selection-tools"
      initial={{ opacity: 0, y: -8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
      className="absolute top-22 right-4 md:right-auto md:left-1/2 md:-translate-x-1/2 flex flex-row items-center gap-1 p-1 bg-white dark:bg-neutral-800 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-700 pointer-events-auto overflow-hidden no-scrollbar transition-all z-50" onMouseDown={preventFocusLoss}>
      <div className="px-1 cursor-grab text-neutral-300 dark:text-neutral-600"><GripVertical className="h-4 w-4" /></div>

      {!isLocked && (
        <>
          {showFill && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-md" title="Style">
                  <Palette className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64 p-3 select-none" align="start" sideOffset={10}>
                <DropdownMenuLabel className="mb-2">Apparence</DropdownMenuLabel>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <span className="text-xs text-neutral-500 font-medium">Palette marque</span>
                    <div className="flex flex-wrap gap-1.5 items-center">
                      {brandColors.map((color, i) => (
                        <button
                          key={`${color}-${i}`}
                          type="button"
                          title="Appliquer la couleur"
                          className="h-6 w-6 rounded-full border-2 border-white dark:border-neutral-600 shadow-sm hover:scale-110 transition-transform"
                          style={{ backgroundColor: color }}
                          onClick={() => setFill(color)}
                        />
                      ))}
                      <input
                        type="color"
                        className="h-6 w-6 rounded cursor-pointer border-0 p-0"
                        value={brandColors[0] || "#2563EB"}
                        title="Modifier la couleur principale"
                        onChange={(e) => {
                          const next = [...brandColors];
                          next[0] = e.target.value;
                          setBrandColors(next);
                          setFill(e.target.value);
                        }}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs text-neutral-500 font-medium">
                      <span>Remplissage</span>
                      <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-red-50 text-neutral-400 hover:text-red-500 rounded-full" onClick={() => setFill("transparent")}><Ban className="h-3 w-3" /></Button>
                    </div>
                    <input type="color" value={currentFill} className="h-8 w-full cursor-pointer rounded border border-neutral-200" onChange={(e) => setFill(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <span className="text-xs text-neutral-500 font-medium">Contour</span>
                    <div className="flex gap-2 items-center">
                      <input type="color" value={currentStroke} className="h-8 w-10 shrink-0 cursor-pointer rounded border border-neutral-200" onChange={(e) => setStroke(e.target.value)} />
                      <input type="range" min="0" max="20" value={localStrokeWidth} className="flex-1 h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer" onPointerDown={(e) => { e.stopPropagation(); setIsDraggingSlider(true); }} onPointerUp={() => setIsDraggingSlider(false)} onChange={(e) => { setLocalStrokeWidth(parseInt(e.target.value)); setStrokeWidth(parseInt(e.target.value)); }} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <span className="text-xs text-neutral-500 font-medium">Arrondi</span>
                    <input type="range" min="0" max="100" value={localCornerRadius} className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer" onPointerDown={(e) => { e.stopPropagation(); setIsDraggingSlider(true); }} onPointerUp={() => setIsDraggingSlider(false)} onChange={(e) => { setLocalCornerRadius(parseInt(e.target.value)); setCornerRadius(parseInt(e.target.value)); }} />
                  </div>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {hasTextLayer && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-md" title="Texte">
                  <Type className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-72 p-3" align="start" sideOffset={10}>
                <DropdownMenuLabel className="mb-2">Format du texte</DropdownMenuLabel>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Select value={currentFontFamily} onValueChange={setFontFamily}>
                      <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Police" /></SelectTrigger>
                      <SelectContent>{FONTS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
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

          {hasNoteLayer && !readOnly && (
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Ajouter une tâche" onClick={() => selection.forEach((id) => addChecklistItem(id))}>
              <ListChecks className="h-4 w-4" />
            </Button>
          )}

          {!readOnly && multiSelect && (
            <div className="flex items-center gap-0.5">
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Grouper" onClick={() => groupSelection()}><Group className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Dégrouper" onClick={() => ungroupSelection()}><Ungroup className="h-4 w-4" /></Button>
            </div>
          )}

          {!readOnly && selection.length === 1 && (
            <div className="flex items-center gap-0.5 px-1">
              {REACTIONS.map((emoji) => (
                <button key={emoji} type="button" className="text-sm hover:scale-125 transition-transform" title="Réagir" onClick={() => toggleReaction(selection[0], emoji)}>
                  {emoji}
                </button>
              ))}
            </div>
          )}

          {hasNoteLayer && (
            <div className="flex items-center gap-0.5 px-1">
              {NOTE_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className="h-5 w-5 rounded-full border border-neutral-200 dark:border-neutral-600 hover:scale-110 transition-transform"
                  style={{ backgroundColor: color }}
                  title="Couleur de note"
                  onClick={() => applyToSelection({ fill: color })}
                />
              ))}
            </div>
          )}

          {multiSelect && (
            <>
              <div className="flex items-center gap-0.5">
                <Button variant="ghost" size="icon" className="h-8 w-8" title="Aligner à gauche" onClick={() => alignSelection("left")}><AlignLeft className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" title="Centrer horizontalement" onClick={() => alignSelection("center")}><AlignCenter className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" title="Aligner à droite" onClick={() => alignSelection("right")}><AlignRight className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" title="Aligner en haut" onClick={() => alignSelection("top")}><AlignVerticalJustifyStart className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" title="Centrer verticalement" onClick={() => alignSelection("middle")}><AlignVerticalJustifyCenter className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" title="Aligner en bas" onClick={() => alignSelection("bottom")}><AlignVerticalJustifyEnd className="h-4 w-4" /></Button>
              </div>
              {canDistribute && (
                <div className="flex items-center gap-0.5">
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Distribuer horizontalement" onClick={() => distributeSelection("horizontal")}><AlignHorizontalDistributeCenter className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Distribuer verticalement" onClick={() => distributeSelection("vertical")}><AlignVerticalDistributeCenter className="h-4 w-4" /></Button>
                </div>
              )}
              <div className="w-[1px] h-6 bg-neutral-200 dark:bg-neutral-700 mx-1" />
            </>
          )}

          <div className="w-[1px] h-6 bg-neutral-200 dark:bg-neutral-700 mx-1" />
        </>
      )}

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={toggleLock} title={isLocked ? "Déverrouiller" : "Verrouiller"} className={`h-8 w-8 hover:bg-neutral-100 shrink-0 ${isLocked ? "text-red-500 bg-red-50 hover:bg-red-100" : ""}`}>
          {isLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
        </Button>
        {!isLocked && (
          <Button variant="ghost" size="icon" onClick={() => duplicateLayers()} title="Dupliquer (Ctrl+D)" className="h-8 w-8 hover:bg-neutral-100 shrink-0">
            <Copy className="h-4 w-4" />
          </Button>
        )}
        <Button variant="ghost" size="icon" onClick={() => deleteLayers()} title="Supprimer" className="h-8 w-8 hover:bg-red-100 hover:text-red-600 shrink-0">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
      )}
    </AnimatePresence>
  );
});

SelectionTools.displayName = "SelectionTools";
