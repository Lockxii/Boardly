import { useCanvasStore } from "@/store/canvas-store";
import { pointerEventToCanvasPoint } from "@/lib/utils";
import { nanoid } from "nanoid";
import { Toolbar } from "./toolbar";
import { PencilToolbar } from "./pencil-toolbar";
import { BrushPreview } from "./brush-preview";
import React, { useCallback, useEffect, useState } from "react";
import { SelectionTools } from "./selection-tools";
import { ZoomControls } from "./zoom-controls";
import { Navbar } from "./navbar";
import { Minimap } from "./minimap";
import { CommandPalette } from "./command-palette";
import { StatusBar } from "./status-bar";
import { ShortcutsHelp } from "./shortcuts-help";
import { ConnectionsLayer } from "./connections-layer";
import { ConnectionTools } from "./connection-tools";
import { CursorsPresence } from "./cursors-presence";
import { BoardSearchDialog } from "./board-search-dialog";
import { LayerCommentsPanel } from "./layer-comments-panel";
import { HtmlLayerOverlay } from "./html-layer-overlay";
import { CanvasLayers } from "./canvas-layers";
import { CanvasOverlay } from "./canvas-overlay";
import { PasteGhost } from "./paste-ghost";
import { DropPreviewGhost } from "./drop-preview-ghost";
import { PresentationMode } from "./presentation-mode";
import { toast } from "sonner";
import type { Layer, LayerType } from "@/lib/types";
import { BLUEPRINT } from "@/lib/template-styles";
import { compressDataUrl } from "@/lib/canvas-utils";
import { findColumnAtPoint, pointInLayer, rubberBand } from "@/lib/motion-utils";
import { extractPlainTextFromClipboard, extractUrlsFromClipboard } from "@/lib/clipboard-utils";
import { getDefaultPastePoint, pasteUrlsAt } from "@/lib/link-paste-actions";
import { extractImageFilesFromClipboard, insertImagesAt } from "@/lib/image-insert-actions";
import {
  extractDropPayload,
  getDropPreviewKind,
  getDropPreviewLabel,
  hasDropPayload,
  screenToCanvasPoint,
} from "@/lib/canvas-drop";
import { filePreviewKey } from "@/lib/image-insert";
import type { DropPreviewKind } from "@/lib/canvas-drop";

export function Canvas({
  template,
  title,
  boardId,
  roomId,
  readOnly = false,
  isPublic = false,
  isOwner = false,
}: {
  template: string;
  title: string;
  boardId?: string;
  roomId?: string;
  readOnly?: boolean;
  isPublic?: boolean;
  isOwner?: boolean;
}) {
  const {
    camera, setCamera, canvasState, setCanvasState,
    pencilTool,
    showGrid, showMinimap, showCommandPalette, setShowCommandPalette,
    setShowSearch,
    snapToGrid, toggleSnapToGrid,
    layerIds, layers, selection, setSelection, setCursor,
    insertLayer, deleteLayers, duplicateLayers, updateLayer, updateLayerText, nudgeLayers,
    pushHistory, undo, redo, canUndo, canRedo,
    addAuditEntry, setReadOnly,
  } = useCanvasStore();

  const pencilDraft = React.useRef<string | null>(null);
  const clipboardRef = React.useRef<Layer[]>([]);
  const translateGhostRef = React.useRef<Record<string, Layer> | null>(null);
  const lastCursorSyncRef = React.useRef(0);
  const panVelocityRef = React.useRef({ x: 0, y: 0 });
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [translateGhost, setTranslateGhost] = useState<Record<string, Layer> | null>(null);
  const [cursorPoint, setCursorPoint] = useState<{ x: number; y: number } | null>(null);
  const [pasteGhostKind, setPasteGhostKind] = useState<"layer" | "link" | "image" | null>(null);
  const [pasteGhostPreview, setPasteGhostPreview] = useState<string | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [dropPreview, setDropPreview] = useState<{
    kind: DropPreviewKind;
    previews: string[];
    label: string;
    x: number;
    y: number;
  } | null>(null);
  const pastePointRef = React.useRef<{ x: number; y: number } | null>(null);
  const dropDepthRef = React.useRef(0);
  const dropPreviewCacheRef = React.useRef<Map<string, string>>(new Map());
  const mainRef = React.useRef<HTMLElement>(null);
  const showPresentation = useCanvasStore((s) => s.showPresentation);
  const setShowPresentation = useCanvasStore((s) => s.setShowPresentation);

  useEffect(() => {
    setReadOnly(readOnly);
    return () => setReadOnly(false);
  }, [readOnly, setReadOnly]);

  useEffect(() => {
    const state = useCanvasStore.getState();
    if (!state.commentsPanelOpen || !state.commentsLayerId) return;
    if (selection.length !== 1 || selection[0] !== state.commentsLayerId) {
      state.closeCommentsPanel();
    }
  }, [selection]);

  const pencilThickness = useCanvasStore((s) => s.pencilThickness);
  const lastUsedColor = useCanvasStore((s) => s.lastUsedColor);

  // Helper: get layers as Map-like interface for compatibility
  const layersMap = React.useMemo(() => {
    const map = new Map<string, Layer>();
    for (const [id, layer] of Object.entries(layers)) {
      map.set(id, layer);
    }
    return map;
  }, [layers]);

  const syncCursor = useCallback((point: { x: number; y: number } | null) => {
    const now = Date.now();
    if (point && now - lastCursorSyncRef.current < 40) return;
    lastCursorSyncRef.current = now;
    setCursor(point);
  }, [setCursor]);

  const collectMovingLayerIds = useCallback((state: ReturnType<typeof useCanvasStore.getState>) => {
    const moving = new Set(state.selection);
    for (const id of state.selection) {
      const g = state.layers[id]?.groupId;
      if (!g) continue;
      for (const [lid, layer] of Object.entries(state.layers)) {
        if (layer.groupId === g) moving.add(lid);
      }
    }
    return moving;
  }, []);

  const captureTranslateGhost = useCallback(() => {
    const state = useCanvasStore.getState();
    const moving = collectMovingLayerIds(state);
    const ghost: Record<string, Layer> = {};
    for (const id of moving) {
      const layer = state.layers[id];
      if (layer) ghost[id] = { ...layer };
    }
    translateGhostRef.current = ghost;
    setTranslateGhost(ghost);
  }, [collectMovingLayerIds]);

  const clearTranslateGhost = useCallback(() => {
    translateGhostRef.current = null;
    setTranslateGhost(null);
    useCanvasStore.getState().setDropTargetColumnId(null);
  }, []);

  const clearDropPreview = useCallback(() => {
    for (const url of dropPreviewCacheRef.current.values()) URL.revokeObjectURL(url);
    dropPreviewCacheRef.current.clear();
    setDropPreview(null);
  }, []);

  const updateDropPreview = useCallback(
    (dataTransfer: DataTransfer, clientX: number, clientY: number) => {
      const kind = getDropPreviewKind(dataTransfer);
      if (!kind) {
        clearDropPreview();
        return;
      }

      const { imageFiles } = extractDropPayload(dataTransfer);
      const previews: string[] = [];
      for (const file of imageFiles.slice(0, 4)) {
        const key = filePreviewKey(file);
        if (!dropPreviewCacheRef.current.has(key)) {
          dropPreviewCacheRef.current.set(key, URL.createObjectURL(file));
        }
        previews.push(dropPreviewCacheRef.current.get(key)!);
      }

      setDropPreview({
        kind,
        previews,
        label: getDropPreviewLabel(dataTransfer),
        x: clientX,
        y: clientY,
      });
    },
    [clearDropPreview],
  );

  const copyLayers = useCallback(() => {
    const copied: Layer[] = [];
    for (const id of selection) {
      const layer = layers[id];
      if (layer) copied.push({ ...layer });
    }
    clipboardRef.current = copied;
    if (copied.length > 0) {
      setPasteGhostKind("layer");
      toast.success(`${copied.length} élément${copied.length > 1 ? "s" : ""} copié${copied.length > 1 ? "s" : ""}`);
    }
  }, [selection, layers]);

  useEffect(() => {
    return () => {
      for (const url of dropPreviewCacheRef.current.values()) URL.revokeObjectURL(url);
      if (pasteGhostPreview) URL.revokeObjectURL(pasteGhostPreview);
    };
  }, [pasteGhostPreview]);

  const pasteLayers = useCallback(() => {
    if (clipboardRef.current.length === 0) return false;
    useCanvasStore.getState().pushHistory();
    const newSelection: string[] = [];
    for (const layerData of clipboardRef.current) {
      const id = nanoid();
      useCanvasStore.setState((s) => ({
        layers: { ...s.layers, [id]: { ...layerData, x: layerData.x + 30, y: layerData.y + 30, locked: false } },
        layerIds: [...s.layerIds, id],
      }));
      newSelection.push(id);
    }
    setSelection(newSelection);
    setPasteGhostKind(null);
    toast.success(`${clipboardRef.current.length} élément${clipboardRef.current.length > 1 ? "s" : ""} collé${clipboardRef.current.length > 1 ? "s" : ""}`);
    return true;
  }, [setSelection]);

  const insertTextAt = useCallback((text: string, point?: { x: number; y: number }) => {
    const centerX = point?.x ?? pastePointRef.current?.x ?? (window.innerWidth / 2 - camera.x) / camera.zoom;
    const centerY = point?.y ?? pastePointRef.current?.y ?? (window.innerHeight / 2 - camera.y) / camera.zoom;
    const id = nanoid();
    useCanvasStore.getState().pushHistory();
    const width = Math.min(420, Math.max(160, text.length * 7));
    useCanvasStore.setState((s) => ({
      layers: {
        ...s.layers,
        [id]: {
          type: "Text" as LayerType,
          x: centerX - width / 2,
          y: centerY - 20,
          width,
          height: 48,
          fill: "transparent",
          value: text,
        } as Layer,
      },
      layerIds: [...s.layerIds, id],
      selection: [id],
      canvasState: { mode: "none" },
    }));
    useCanvasStore.getState().addAuditEntry("created", "Text");
    toast.success("Texte collé");
  }, [camera]);

  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      if (readOnly) return;
      const ae = document.activeElement as HTMLElement;
      if (ae?.tagName === "TEXTAREA" || ae?.tagName === "INPUT" || ae?.isContentEditable) return;

      const imageFiles = extractImageFilesFromClipboard(e.clipboardData);
      if (imageFiles.length > 0) {
        e.preventDefault();
        setPasteGhostKind(null);
        if (pasteGhostPreview) URL.revokeObjectURL(pasteGhostPreview);
        setPasteGhostPreview(null);
        const point = pastePointRef.current ?? getDefaultPastePoint(camera);
        await insertImagesAt(imageFiles, point);
        return;
      }

      const urls = extractUrlsFromClipboard(e.clipboardData);
      if (urls.length > 0) {
        e.preventDefault();
        setPasteGhostKind(null);
        const point = pastePointRef.current ?? getDefaultPastePoint(camera);
        await pasteUrlsAt(urls, point);
        return;
      }

      const plainText = extractPlainTextFromClipboard(e.clipboardData);
      if (plainText) {
        e.preventDefault();
        const point = pastePointRef.current ?? getDefaultPastePoint(camera);
        insertTextAt(plainText, point);
        return;
      }

      if (clipboardRef.current.length > 0) {
        e.preventDefault();
        pasteLayers();
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [insertTextAt, pasteLayers, camera, readOnly, pasteGhostPreview]);

  useEffect(() => {
    if (readOnly) return;
    const onCopy = (e: ClipboardEvent) => {
      const ae = document.activeElement as HTMLElement;
      if (ae?.tagName === "TEXTAREA" || ae?.tagName === "INPUT" || ae?.isContentEditable) return;
      const imageFiles = extractImageFilesFromClipboard(e.clipboardData);
      if (imageFiles.length === 0) return;
      const preview = URL.createObjectURL(imageFiles[0]);
      setPasteGhostPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return preview;
      });
      setPasteGhostKind("image");
    };
    window.addEventListener("copy", onCopy);
    return () => window.removeEventListener("copy", onCopy);
  }, [readOnly]);

  const handleCanvasDrop = useCallback(
    async (e: React.DragEvent) => {
      if (readOnly) return;
      e.preventDefault();
      dropDepthRef.current = 0;
      setDropActive(false);
      clearDropPreview();

      const point = screenToCanvasPoint(e.clientX, e.clientY, camera);
      pastePointRef.current = point;
      const { urls, imageFiles } = extractDropPayload(e.dataTransfer);

      if (imageFiles.length > 0) {
        await insertImagesAt(imageFiles, point);
      }

      if (urls.length > 0) {
        await pasteUrlsAt(urls, point);
      }
    },
    [camera, clearDropPreview, readOnly],
  );

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      if (readOnly || !hasDropPayload(e.dataTransfer)) return;
      e.preventDefault();
      dropDepthRef.current += 1;
      setDropActive(true);
      updateDropPreview(e.dataTransfer, e.clientX, e.clientY);
    },
    [readOnly, updateDropPreview],
  );

  const handleDragLeave = useCallback(() => {
    dropDepthRef.current = Math.max(0, dropDepthRef.current - 1);
    if (dropDepthRef.current === 0) {
      setDropActive(false);
      clearDropPreview();
    }
  }, [clearDropPreview]);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (readOnly || !hasDropPayload(e.dataTransfer)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      updateDropPreview(e.dataTransfer, e.clientX, e.clientY);
    },
    [readOnly, updateDropPreview],
  );

  const startDrawing = useCallback((point: { x: number; y: number }, pressure: number) => {
    // Save pre-mutation state BEFORE drawing
    useCanvasStore.getState().pushHistory();
    const id = nanoid();
    const layer: Layer = {
      type: "Path",
      x: 0, y: 0, height: 0, width: 0,
      fill: lastUsedColor,
      strokeWidth: pencilThickness,
      points: [[point.x, point.y, pressure]],
    };
    useCanvasStore.setState((s) => ({
      layers: { ...s.layers, [id]: layer },
      layerIds: [...s.layerIds, id],
      selection: [id],
    }));
    pencilDraft.current = id;
  }, [lastUsedColor, pencilThickness]);

  const continueDrawing = useCallback((point: { x: number; y: number }, pressure = 0.5) => {
    const layerId = pencilDraft.current;
    if (!layerId) return;
    useCanvasStore.setState((s) => {
      const layer = s.layers[layerId];
      if (!layer) return s;
      const points = [...(layer.points || []), [point.x, point.y, pressure]];
      return { layers: { ...s.layers, [layerId]: { ...layer, points } } };
    });
  }, []);

  const eraser = useCallback((point: { x: number; y: number }) => {
    const state = useCanvasStore.getState();
    const eraserRadius = pencilThickness / 2;
    const eraserRadiusSq = eraserRadius * eraserRadius;
    const ids = [...state.layerIds].reverse();
    for (const id of ids) {
      const layer = state.layers[id];
      if (!layer) continue;
      const { x: lx, y: ly, width: lw, height: lh } = layer;
      if (point.x < lx - eraserRadius || point.x > lx + lw + eraserRadius || point.y < ly - eraserRadius || point.y > ly + lh + eraserRadius) continue;
      if (layer.type === "Path" && layer.points) {
        const localX = point.x - lx;
        const localY = point.y - ly;
        let changed = false;
        const newPoints = layer.points.map((p: number[]) => {
          if (p.length > 3 && p[3] === 1) return p;
          const dx = p[0] - localX;
          const dy = p[1] - localY;
          if (dx * dx + dy * dy < eraserRadiusSq) { changed = true; return [p[0], p[1], p[2], 1]; }
          return p;
        });
        if (changed) useCanvasStore.setState((s) => ({ layers: { ...s.layers, [id]: { ...layer, points: newPoints } } }));
        continue;
      }
      if (point.x >= lx - 5 && point.x <= lx + lw + 5 && point.y >= ly - 5 && point.y <= ly + lh + 5) {
        addAuditEntry("deleted", layer.type);
        useCanvasStore.setState((s) => {
          const newLayers = { ...s.layers };
          delete newLayers[id];
          return { layers: newLayers, layerIds: s.layerIds.filter((i) => i !== id) };
        });
      }
    }
  }, [pencilThickness, addAuditEntry]);

  const insertPath = useCallback(() => {
    const layerId = pencilDraft.current;
    if (!layerId) return;
    const state = useCanvasStore.getState();
    const layer = state.layers[layerId];
    if (!layer) { pencilDraft.current = null; return; }
    const points = layer.points || [];
    if (points.length < 2) {
      useCanvasStore.setState((s) => {
        const newLayers = { ...s.layers };
        delete newLayers[layerId];
        return { layers: newLayers, layerIds: s.layerIds.filter((i) => i !== layerId) };
      });
      pencilDraft.current = null;
      return;
    }
    // Save pre-mutation state BEFORE finalizing path
    useCanvasStore.getState().pushHistory();
    const xs = points.map((p: number[]) => p[0]);
    const ys = points.map((p: number[]) => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const newPoints = points.map((p: number[]) => [p[0] - minX, p[1] - minY, p[2], p[3] ?? 0]);
    useCanvasStore.setState((s) => ({
      layers: { ...s.layers, [layerId]: { ...layer, x: minX, y: minY, width: maxX - minX, height: maxY - minY, points: newPoints } },
    }));
    addAuditEntry("created", "Tracé");
    pencilDraft.current = null;
  }, [addAuditEntry]);

  // Translate
  const translateSelectedLayers = useCallback((point: { x: number; y: number }) => {
    const state = useCanvasStore.getState();
    if (state.canvasState.mode !== "translating") return;
    let offsetX = point.x - state.canvasState.current.x;
    let offsetY = point.y - state.canvasState.current.y;
    if (state.snapToGrid && state.selection.length > 0) {
      const first = state.layers[state.selection[0]];
      if (first) {
        const snap = (v: number, g = 20) => Math.round(v / g) * g;
        const targetX = snap(first.x + offsetX);
        const targetY = snap(first.y + offsetY);
        offsetX = targetX - first.x;
        offsetY = targetY - first.y;
      }
    }
    useCanvasStore.setState((s) => {
      const newLayers = { ...s.layers };
      const moving = new Set(s.selection);
      for (const id of s.selection) {
        const g = s.layers[id]?.groupId;
        if (g) {
          for (const [lid, layer] of Object.entries(s.layers)) {
            if (layer.groupId === g) moving.add(lid);
          }
        }
      }
      for (const id of moving) {
        const layer = newLayers[id];
        if (layer) newLayers[id] = { ...layer, x: layer.x + offsetX, y: layer.y + offsetY };
      }
      return { layers: newLayers, canvasState: { mode: "translating", current: point } };
    });
  }, []);

  // Resize
  const resizeSelectedLayer = useCallback((point: { x: number; y: number }, isShift: boolean) => {
    const state = useCanvasStore.getState();
    if (state.canvasState.mode !== "resizing") return;
    const { initialBounds, initialStart } = state.canvasState;
    const deltaX = point.x - initialStart.x;
    const deltaY = point.y - initialStart.y;
    const id = state.selection[0];
    if (!id) return;
    const layer = state.layers[id];
    if (!layer) return;
    let w = Math.max(initialBounds.width + deltaX, 10);
    let h = Math.max(initialBounds.height + deltaY, 10);
    if (isShift) {
      const ar = initialBounds.width / initialBounds.height;
      if (Math.abs(deltaX) > Math.abs(deltaY)) h = w / ar; else w = h * ar;
    }
    useCanvasStore.setState((s) => ({ layers: { ...s.layers, [id]: { ...layer, width: w, height: h } } }));
  }, []);

  // Rotate
  const rotateSelectedLayer = useCallback((point: { x: number; y: number }) => {
    const state = useCanvasStore.getState();
    if (state.canvasState.mode !== "rotating") return;
    const { centerX, centerY } = state.canvasState;
    const dx = point.x - centerX;
    const dy = point.y - centerY;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
    const id = state.selection[0];
    if (!id) return;
    const layer = state.layers[id];
    if (!layer) return;
    useCanvasStore.setState((s) => ({ layers: { ...s.layers, [id]: { ...layer, rotation: angle } } }));
  }, []);

  // Pointer handlers
  const processPointerMove = useCallback((e: Pick<PointerEvent, "clientX" | "clientY" | "buttons" | "shiftKey" | "pressure">) => {
    const cam = useCanvasStore.getState().camera;
    const current = {
      x: Math.round((e.clientX - cam.x) / cam.zoom),
      y: Math.round((e.clientY - cam.y) / cam.zoom),
    };
    pastePointRef.current = current;
    syncCursor(current);
    const state = useCanvasStore.getState();
    // cursorPoint only drives the snap guides (translating + snapToGrid) and the
    // in-progress connection line. Skipping it on idle hover avoids re-rendering
    // the whole Canvas subtree on every pointer move.
    if (state.connectFromId || (state.canvasState.mode === "translating" && state.snapToGrid)) {
      setCursorPoint(current);
    }

    if (state.connectFromId) {
      let hover: string | null = null;
      for (let i = state.layerIds.length - 1; i >= 0; i--) {
        const id = state.layerIds[i];
        const layer = state.layers[id];
        if (layer && id !== state.connectFromId && pointInLayer(current, layer)) {
          hover = id;
          break;
        }
      }
      state.setConnectHoverId(hover);
    }

    if (state.canvasState.mode === "translating") {
      translateSelectedLayers(current);
      const hasNote = state.selection.some((id) => state.layers[id]?.type === "Note");
      if (hasNote) {
        state.setDropTargetColumnId(findColumnAtPoint(state.layers, state.layerIds, current));
      }
    } else if (state.canvasState.mode === "resizing") resizeSelectedLayer(current, e.shiftKey);
    else if (state.canvasState.mode === "rotating") rotateSelectedLayer(current);
    else if (state.canvasState.mode === "panning" && state.canvasState.start && state.canvasState.camStart) {
      const { start, camStart } = state.canvasState;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      panVelocityRef.current = { x: dx * 0.08, y: dy * 0.08 };
      const rawX = camStart.x + dx;
      const rawY = camStart.y + dy;
      setCamera({
        x: rubberBand(rawX, -8000, 8000),
        y: rubberBand(rawY, -8000, 8000),
        zoom: cam.zoom,
      });
    } else if (state.canvasState.mode === "selectionNet") {
      setCanvasState({ mode: "selectionNet", origin: state.canvasState.origin, current });
    } else if (state.canvasState.mode === "inserting" && state.canvasState.origin) {
      setCanvasState({ ...state.canvasState, current });
    } else if (state.canvasState.mode === "pencil") {
      if (pencilTool === "draw") continueDrawing(current, e.pressure || 0.5);
      else if (pencilTool === "erase" && e.buttons === 1) eraser(current);
    }
  }, [syncCursor, setCanvasState, pencilTool, translateSelectedLayers, resizeSelectedLayer, rotateSelectedLayer, continueDrawing, eraser, setCamera]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    processPointerMove(e);
  }, [processPointerMove]);

  const processPointerUp = useCallback((e: Pick<PointerEvent, "clientX" | "clientY">) => {
    const cam = useCanvasStore.getState().camera;
    const point = {
      x: Math.round((e.clientX - cam.x) / cam.zoom),
      y: Math.round((e.clientY - cam.y) / cam.zoom),
    };
    const state = useCanvasStore.getState();
    if (state.canvasState.mode === "translating" || state.canvasState.mode === "resizing" || state.canvasState.mode === "rotating") {
      if (state.selection.length > 0) {
        const layer = state.layers[state.selection[0]];
        if (layer) addAuditEntry("modified", layer.type);
      }
      clearTranslateGhost();
      setCanvasState({ mode: "none" });
    } else if (state.canvasState.mode === "panning") {
      setCanvasState({ mode: "panning" });
    } else if (state.canvasState.mode === "selectionNet") {
      const ids: string[] = [];
      const left = Math.min(state.canvasState.origin.x, point.x);
      const right = Math.max(state.canvasState.origin.x, point.x);
      const top = Math.min(state.canvasState.origin.y, point.y);
      const bottom = Math.max(state.canvasState.origin.y, point.y);
      for (const [id, layer] of Object.entries(state.layers)) {
        if (layer.x < right && layer.x + layer.width > left && layer.y < bottom && layer.y + layer.height > top) ids.push(id);
      }
      setSelection(ids);
      if (ids.length === 0) {
        state.dismissConnectionTools();
      }
      setCanvasState({ mode: "none" });
    } else if (state.canvasState.mode === "inserting") {
      const { origin } = state.canvasState;
      if (origin) {
        const w = Math.abs(point.x - origin.x);
        const h = Math.abs(point.y - origin.y);
        const x = Math.min(point.x, origin.x);
        const y = Math.min(point.y, origin.y);
        if (w < 5 && h < 5) {
          if (state.canvasState.layerType === "Line") insertLayer("Line", point.x - 50, point.y, 100, 0);
          else insertLayer(state.canvasState.layerType, point.x, point.y);
        } else {
          insertLayer(
            state.canvasState.layerType,
            x,
            y,
            Math.max(w, state.canvasState.layerType === "Line" ? 20 : 5),
            Math.max(h, state.canvasState.layerType === "Line" ? 0 : 5)
          );
        }
      }
    } else if (state.canvasState.mode === "pencil") {
      if (pencilTool === "draw") insertPath();
    }
  }, [setCanvasState, setSelection, insertLayer, insertPath, addAuditEntry, clearTranslateGhost, pencilTool]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    processPointerUp(e);
  }, [processPointerUp]);

  useEffect(() => {
    if (readOnly) return;

    const onWindowPointerMove = (e: PointerEvent) => {
      const state = useCanvasStore.getState();
      if (state.canvasState.mode === "none" && !state.connectFromId) return;
      processPointerMove(e);
    };

    const onWindowPointerUp = (e: PointerEvent) => {
      processPointerUp(e);
    };

    window.addEventListener("pointermove", onWindowPointerMove);
    window.addEventListener("pointerup", onWindowPointerUp);
    window.addEventListener("pointercancel", onWindowPointerUp);
    return () => {
      window.removeEventListener("pointermove", onWindowPointerMove);
      window.removeEventListener("pointerup", onWindowPointerUp);
      window.removeEventListener("pointercancel", onWindowPointerUp);
    };
  }, [readOnly, processPointerMove, processPointerUp]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const point = pointerEventToCanvasPoint(e, camera);
    const state = useCanvasStore.getState();
    if (state.canvasState.mode === "panning") {
      setCanvasState({
        mode: "panning",
        start: { x: e.clientX, y: e.clientY },
        camStart: { x: camera.x, y: camera.y },
      });
      return;
    }
    if (state.canvasState.mode === "inserting") {
      setCanvasState({ ...state.canvasState, origin: point, current: point });
      return;
    }
    if (state.canvasState.mode === "pencil") {
      if (pencilTool === "draw") startDrawing(point, e.pressure);
      else eraser(point);
      return;
    }
    if (state.canvasState.mode === "none") setCanvasState({ mode: "selectionNet", origin: point, current: point });
  }, [camera, setCanvasState, pencilTool, startDrawing, eraser]);

  const onLayerPointerDown = useCallback((e: React.PointerEvent, layerId: string) => {
    e.stopPropagation();
    const point = pointerEventToCanvasPoint(e, camera);
    const state = useCanvasStore.getState();
    const layer = state.layers[layerId];
    if (layer?.locked) return;

    if (state.connectFromId) {
      if (state.connectFromId === layerId) {
        state.setConnectFromId(null);
        toast.message("Relier annulé");
        return;
      }
      state.addConnection(state.connectFromId, layerId);
      state.setConnectHoverId(null);
      toast.success("Éléments reliés");
      return;
    }

    state.setSelectedConnectionId(null);

    if (!state.selection.includes(layerId)) {
      setSelection([layerId]);
    }
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    state.pushHistory();
    captureTranslateGhost();
    setCanvasState({ mode: "translating", current: point });
  }, [camera, setSelection, setCanvasState, captureTranslateGhost]);

  const onConnectionPointerDown = useCallback((e: React.PointerEvent, connectionId: string) => {
    e.stopPropagation();
    const state = useCanvasStore.getState();
    if (state.selectedConnectionId === connectionId) {
      state.dismissConnectionTools();
      setCanvasState({ mode: "none" });
      return;
    }
    state.setSelectedConnectionId(connectionId);
    state.setConnectFromId(null);
    state.setConnectHoverId(null);
    setCanvasState({ mode: "none" });
  }, [setCanvasState]);

  const onResizeHandlePointerDown = useCallback((e: React.PointerEvent, initialBounds: any) => {
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const point = pointerEventToCanvasPoint(e, camera);
    // Save pre-mutation state BEFORE resize
    useCanvasStore.getState().pushHistory();
    setCanvasState({ mode: "resizing", initialBounds, initialStart: point, corner: "bottom-right" });
  }, [camera, setCanvasState]);

  const onLayerRotatePointerDown = useCallback((e: React.PointerEvent, layerId: string) => {
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const layer = useCanvasStore.getState().layers[layerId];
    if (!layer || layer.locked) return;
    const centerX = layer.x + layer.width / 2;
    const centerY = layer.y + layer.height / 2;
    // Save pre-mutation state BEFORE rotate
    useCanvasStore.getState().pushHistory();
    setCanvasState({ mode: "rotating", initialAngle: layer.rotation || 0, centerX, centerY });
  }, [setCanvasState]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const ae = document.activeElement as HTMLElement;
      const isInput = ae?.tagName === "TEXTAREA" || ae?.tagName === "INPUT" || ae?.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        useCanvasStore.getState().setShowCommandPalette(!useCanvasStore.getState().showCommandPalette);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        useCanvasStore.getState().setShowSearch(true);
        return;
      }

      if (e.key === "Escape") {
        if (useCanvasStore.getState().showPresentation) { useCanvasStore.getState().setShowPresentation(false); return; }
        if (useCanvasStore.getState().showFredPanel) { useCanvasStore.getState().setShowFredPanel(false); return; }
        if (useCanvasStore.getState().showCommandPalette) { useCanvasStore.getState().setShowCommandPalette(false); return; }
        if (showShortcuts) { setShowShortcuts(false); return; }
        useCanvasStore.getState().dismissConnectionTools();
        setCanvasState({ mode: "none" });
        setSelection([]);
        return;
      }

      const store = useCanvasStore.getState();

      if (e.key === "?" && !isInput) {
        e.preventDefault();
        setShowShortcuts((v) => !v);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        e.preventDefault();
        if (store.selection.length === 2) store.addConnection(store.selection[0], store.selection[1]);
        else copyLayers();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        return;
      }

      if (isInput) return;

      switch (e.key) {
        case "h":
          setCanvasState({ mode: "panning" });
          store.dismissConnectionTools();
          break;
        case "l":
          setCanvasState({ mode: "inserting", layerType: "Line" });
          store.dismissConnectionTools();
          break;
        case "F": if (e.shiftKey) setCanvasState({ mode: "inserting", layerType: "Frame" }); break;
        case "P": if (e.shiftKey && !readOnly) { e.preventDefault(); useCanvasStore.getState().setShowPresentation(true); } break;
        case "A": if (e.shiftKey && !readOnly) { e.preventDefault(); useCanvasStore.getState().setShowFredPanel(!useCanvasStore.getState().showFredPanel); } break;
        case "Delete": case "Backspace":
          if (store.selectedConnectionId) {
            store.removeConnection(store.selectedConnectionId);
          } else {
            store.deleteLayers();
          }
          break;
        case "d": if (e.ctrlKey || e.metaKey) { e.preventDefault(); store.duplicateLayers(); } break;
        case "z": if (e.ctrlKey || e.metaKey) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); } break;
        case "v": if (!e.ctrlKey && !e.metaKey) { setCanvasState({ mode: "none" }); store.dismissConnectionTools(); } break;
        case "r": if (!e.ctrlKey && !e.metaKey) setCanvasState({ mode: "inserting", layerType: "Rectangle" }); break;
        case "e": if (!e.ctrlKey && !e.metaKey) setCanvasState({ mode: "inserting", layerType: "Ellipse" }); break;
        case "t": if (!e.ctrlKey && !e.metaKey) setCanvasState({ mode: "inserting", layerType: "Text" }); break;
        case "n": if (!e.ctrlKey && !e.metaKey) setCanvasState({ mode: "inserting", layerType: "Note" }); break;
        case "p": if (!e.ctrlKey && !e.metaKey) { setCanvasState({ mode: "pencil" }); store.setPencilTool("draw"); } break;
        case "x": if (!e.ctrlKey && !e.metaKey) { setCanvasState({ mode: "pencil" }); store.setPencilTool("erase"); } break;
        case "g": if (!e.ctrlKey && !e.metaKey) store.toggleGrid(); break;
        case "m": if (!e.ctrlKey && !e.metaKey) store.toggleMinimap(); break;
        case "s": if (e.shiftKey && !e.ctrlKey && !e.metaKey) { e.preventDefault(); store.toggleSnapToGrid(); toast.info(`Snap to grid: ${store.snapToGrid ? "ON" : "OFF"}`); } break;
        case "0": if (e.ctrlKey || e.metaKey) { e.preventDefault(); setCamera({ x: 0, y: 0, zoom: 1 }); } break;
        case "=": case "+": if (e.ctrlKey || e.metaKey) { e.preventDefault(); setCamera({ ...camera, zoom: Math.min(camera.zoom + 0.1, 5) }); } break;
        case "-": if (e.ctrlKey || e.metaKey) { e.preventDefault(); setCamera({ ...camera, zoom: Math.max(camera.zoom - 0.1, 0.1) }); } break;
        case "f":
          if (!e.ctrlKey && !e.metaKey && layerIds.length > 0) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const id of layerIds) {
              const layer = layers[id];
              if (layer) { minX = Math.min(minX, layer.x); minY = Math.min(minY, layer.y); maxX = Math.max(maxX, layer.x + layer.width); maxY = Math.max(maxY, layer.y + layer.height); }
            }
            const w = maxX - minX, h = maxY - minY, padding = 100;
            const zoom = Math.min((window.innerWidth - 200) / (w + padding), (window.innerHeight - 100) / (h + padding), 2);
            setCamera({ x: window.innerWidth / 2 - (minX + w / 2) * zoom, y: window.innerHeight / 2 - (minY + h / 2) * zoom, zoom });
          }
          break;
        case "ArrowUp": e.preventDefault(); store.nudgeLayers(0, e.shiftKey ? -10 : -1); break;
        case "ArrowDown": e.preventDefault(); store.nudgeLayers(0, e.shiftKey ? 10 : 1); break;
        case "ArrowLeft": e.preventDefault(); store.nudgeLayers(e.shiftKey ? -10 : -1, 0); break;
        case "ArrowRight": e.preventDefault(); store.nudgeLayers(e.shiftKey ? 10 : 1, 0); break;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [camera, setCamera, setCanvasState, setSelection, showShortcuts, layers, layerIds, copyLayers, pasteLayers, undo, redo, insertLayer]);

  // Space to pan with momentum
  useEffect(() => {
    let spaceDown = false;
    let startX = 0, startY = 0, startCamX = 0, startCamY = 0;
    let lastX = 0, lastY = 0;
    let momentumRaf = 0;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === " " && !e.repeat) {
        const ae = document.activeElement as HTMLElement;
        if (ae?.tagName === "TEXTAREA" || ae?.tagName === "INPUT" || ae?.isContentEditable) return;
        spaceDown = true; e.preventDefault(); document.body.style.cursor = "grab";
      }
    }
    function onKeyUp(e: KeyboardEvent) { if (e.key === " ") { spaceDown = false; document.body.style.cursor = ""; } }
    function onMouseDown(e: MouseEvent) {
      if (!spaceDown) return;
      cancelAnimationFrame(momentumRaf);
      startX = e.clientX; startY = e.clientY;
      lastX = e.clientX; lastY = e.clientY;
      const cam = useCanvasStore.getState().camera;
      startCamX = cam.x; startCamY = cam.y;
      document.body.style.cursor = "grabbing";
    }
    function onMouseMove(e: MouseEvent) {
      if (!spaceDown || startX === 0) return;
      const cam = useCanvasStore.getState().camera;
      panVelocityRef.current = { x: (e.clientX - lastX) * 0.65, y: (e.clientY - lastY) * 0.65 };
      lastX = e.clientX; lastY = e.clientY;
      setCamera({ x: startCamX + (e.clientX - startX), y: startCamY + (e.clientY - startY), zoom: cam.zoom });
    }
    function onMouseUp() {
      if (spaceDown) document.body.style.cursor = "grab";
      if (startX !== 0) {
        let vx = panVelocityRef.current.x;
        let vy = panVelocityRef.current.y;
        const glide = () => {
          if (Math.abs(vx) < 0.35 && Math.abs(vy) < 0.35) return;
          const cam = useCanvasStore.getState().camera;
          setCamera({ x: cam.x + vx, y: cam.y + vy, zoom: cam.zoom });
          vx *= 0.9;
          vy *= 0.9;
          momentumRaf = requestAnimationFrame(glide);
        };
        momentumRaf = requestAnimationFrame(glide);
      }
      startX = 0;
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      cancelAnimationFrame(momentumRaf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [setCamera]);

  // Block Mac trackpad swipe-back when panning the canvas (horizontal wheel → browser history).
  const handleBoardWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const cam = useCanvasStore.getState().camera;
      if (e.ctrlKey || e.metaKey) {
        const delta = -e.deltaY * 0.001;
        setCamera({ ...cam, zoom: Math.min(Math.max(cam.zoom + delta, 0.1), 5) });
      } else {
        setCamera({ x: cam.x - e.deltaX, y: cam.y - e.deltaY, zoom: cam.zoom });
      }
    },
    [setCamera],
  );

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleBoardWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleBoardWheel);
  }, [handleBoardWheel]);

  useEffect(() => {
    const el = mainRef.current;
    if (!el || readOnly) return;

    const onPointerMove = (e: PointerEvent) => {
      const cam = useCanvasStore.getState().camera;
      const point = {
        x: Math.round((e.clientX - cam.x) / cam.zoom),
        y: Math.round((e.clientY - cam.y) / cam.zoom),
      };
      syncCursor(point);
      const st = useCanvasStore.getState();
      if (st.connectFromId || (st.canvasState.mode === "translating" && st.snapToGrid)) {
        setCursorPoint(point);
      }
    };

    const onPointerLeave = () => {
      syncCursor(null);
      setCursorPoint(null);
    };

    el.addEventListener("pointermove", onPointerMove, { capture: true });
    el.addEventListener("pointerleave", onPointerLeave);
    return () => {
      el.removeEventListener("pointermove", onPointerMove, { capture: true });
      el.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [readOnly, syncCursor]);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overscrollBehavior;
    const prevBody = body.style.overscrollBehavior;
    html.style.overscrollBehavior = "none";
    body.style.overscrollBehavior = "none";
    return () => {
      html.style.overscrollBehavior = prevHtml;
      body.style.overscrollBehavior = prevBody;
    };
  }, []);

  const bgClass =
    template === "blueprint"
      ? BLUEPRINT.canvasClass
      : "bg-neutral-100 dark:bg-neutral-900";
  let cursorStyle = "default";
  if (canvasState.mode === "pencil") cursorStyle = "none";
  else if (canvasState.mode === "inserting") cursorStyle = "crosshair";
  else if (canvasState.mode === "translating") cursorStyle = "grabbing";
  else if (canvasState.mode === "resizing") cursorStyle = "nwse-resize";
  else if (canvasState.mode === "panning") cursorStyle = "grab";

  return (
    <main
      ref={mainRef}
      className={`board-canvas-root h-full w-full relative touch-none overflow-hidden overscroll-none ${bgClass}`}
      style={{ cursor: cursorStyle }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleCanvasDrop}
    >
      <Navbar title={title} boardId={boardId} template={template} isPublic={isPublic} readOnly={readOnly} isOwner={isOwner} />
      {!readOnly && <Toolbar />}
      {!readOnly && <PencilToolbar />}
      {!readOnly && <ConnectionTools />}
      {!readOnly && <SelectionTools camera={camera} />}
      <ZoomControls />
      {!readOnly && <BrushPreview />}
      {showMinimap && <Minimap />}
      {!readOnly && showCommandPalette && <CommandPalette />}
      <BoardSearchDialog />
      {!readOnly && <LayerCommentsPanel />}
      {!readOnly && pasteGhostKind && (
        <PasteGhost
          kind={pasteGhostKind === "layer" ? "layer" : pasteGhostKind === "image" ? "image" : "link"}
          label={
            pasteGhostKind === "layer"
              ? "Éléments copiés — Ctrl+V pour coller"
              : pasteGhostKind === "image"
                ? "Image copiée — Ctrl+V pour coller"
                : undefined
          }
          previewUrl={pasteGhostPreview}
        />
      )}
      {dropActive && !readOnly && (
        <div className="pointer-events-none absolute inset-3 z-[15] rounded-2xl border-2 border-dashed border-blue-400/70 bg-blue-500/5" />
      )}
      {dropPreview && !readOnly && dropPreview.kind && (
        <DropPreviewGhost
          kind={dropPreview.kind}
          previews={dropPreview.previews}
          label={dropPreview.label}
          x={dropPreview.x}
          y={dropPreview.y}
        />
      )}
      <PresentationMode open={showPresentation} onClose={() => setShowPresentation(false)} />
      {showShortcuts && <ShortcutsHelp onClose={() => setShowShortcuts(false)} />}
      <StatusBar />
      <HtmlLayerOverlay
        camera={camera}
        readOnly={readOnly}
        onLayerPointerDown={onLayerPointerDown}
        onLayerResizePointerDown={onResizeHandlePointerDown}
        onLayerRotatePointerDown={onLayerRotatePointerDown}
        onChange={(id, val) => updateLayerText(id, val)}
      />
      <svg
        id="board-canvas"
        className="w-[100vw] h-[100vh] overscroll-none"
        onPointerMove={onPointerMove}
        onPointerLeave={() => { syncCursor(null); setCursorPoint(null); }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        <defs>
          <pattern id="grid-pattern" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="#cbd5e1" />
          </pattern>
          <pattern id="blueprint-pattern" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#C7DCF0" strokeWidth="0.75" className="dark:stroke-slate-600" />
          </pattern>
          <pattern id="blueprint-pattern-major" width="80" height="80" patternUnits="userSpaceOnUse">
            <path d="M 80 0 L 0 0 0 80" fill="none" stroke="#A8C8E8" strokeWidth="1" className="dark:stroke-slate-500" />
          </pattern>
          <marker id="conn-arrow-end" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 Z" fill="#64748B" />
          </marker>
          <marker id="conn-arrow-start" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 10 0 L 0 5 L 10 10 Z" fill="#64748B" />
          </marker>
          <marker id="conn-dot-end" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <circle cx="5" cy="5" r="3.5" fill="#64748B" />
          </marker>
          <marker id="conn-dot-start" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <circle cx="5" cy="5" r="3.5" fill="#64748B" />
          </marker>
        </defs>
        <g className="canvas-g" transform={`translate(${camera.x} ${camera.y}) scale(${camera.zoom})`}>
          {showGrid && template === "grid" && <rect x="-100000" y="-100000" width="200000" height="200000" fill="url(#grid-pattern)" />}
          {showGrid && template === "blueprint" && (
            <>
              <rect x="-100000" y="-100000" width="200000" height="200000" fill="url(#blueprint-pattern)" />
              <rect x="-100000" y="-100000" width="200000" height="200000" fill="url(#blueprint-pattern-major)" />
            </>
          )}
          <ConnectionsLayer onConnectionPointerDown={onConnectionPointerDown} />
          <CanvasLayers
            camera={camera}
            onLayerPointerDown={onLayerPointerDown}
            onLayerResizePointerDown={onResizeHandlePointerDown}
            onLayerRotatePointerDown={onLayerRotatePointerDown}
            onChange={(id, val) => updateLayerText(id, val)}
          />
          <CanvasOverlay translateGhost={translateGhost} cursorPoint={cursorPoint} />
        </g>
      </svg>
      {roomId && (
        <CursorsPresence
          boardId={roomId}
          camera={camera}
          readOnly={readOnly}
        />
      )}
    </main>
  );
}
