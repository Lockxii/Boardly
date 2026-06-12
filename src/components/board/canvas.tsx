import { useCanvasStore } from "@/store/canvas-store";
import { pointerEventToCanvasPoint } from "@/lib/utils";
import { nanoid } from "nanoid";
import { LayerPreview } from "./layer-preview";
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
import { toast } from "sonner";
import type { Layer, LayerType } from "@/lib/types";
import { BLUEPRINT } from "@/lib/template-styles";

export function Canvas({ template, title, boardId }: { template: string; title: string; boardId?: string }) {
  const {
    camera, setCamera, canvasState, setCanvasState,
    pencilTool,
    showGrid, showMinimap, showCommandPalette, setShowCommandPalette,
    snapToGrid, toggleSnapToGrid,
    layerIds, layers, selection, setSelection, setCursor,
    insertLayer, deleteLayers, duplicateLayers, updateLayer, updateLayerText, nudgeLayers,
    pushHistory, undo, redo, canUndo, canRedo,
    addAuditEntry,
  } = useCanvasStore();

  const pencilDraft = React.useRef<string | null>(null);
  const clipboardRef = React.useRef<Layer[]>([]);
  const [showShortcuts, setShowShortcuts] = useState(false);

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

  // Copy
  const copyLayers = useCallback(() => {
    const copied: Layer[] = [];
    for (const id of selection) {
      const layer = layers[id];
      if (layer) copied.push({ ...layer });
    }
    clipboardRef.current = copied;
    if (copied.length > 0) toast.success(`${copied.length} élément${copied.length > 1 ? "s" : ""} copié${copied.length > 1 ? "s" : ""}`);
  }, [selection, layers]);

  // Paste
  const pasteLayers = useCallback(() => {
    if (clipboardRef.current.length === 0) return;
    // Save pre-mutation state BEFORE paste
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
    toast.success(`${clipboardRef.current.length} élément${clipboardRef.current.length > 1 ? "s" : ""} collé${clipboardRef.current.length > 1 ? "s" : ""}`);
  }, [setSelection]);

  // Drawing
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

  const continueDrawing = useCallback((point: { x: number; y: number }, e: React.PointerEvent) => {
    const layerId = pencilDraft.current;
    if (!layerId) return;
    useCanvasStore.setState((s) => {
      const layer = s.layers[layerId];
      if (!layer) return s;
      const points = [...(layer.points || []), [point.x, point.y, e.pressure]];
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
      for (const id of s.selection) {
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
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const current = pointerEventToCanvasPoint(e, camera);
    setCursor(current);
    const state = useCanvasStore.getState();
    if (state.canvasState.mode === "translating") translateSelectedLayers(current);
    else if (state.canvasState.mode === "resizing") resizeSelectedLayer(current, e.shiftKey);
    else if (state.canvasState.mode === "rotating") rotateSelectedLayer(current);
    else if (state.canvasState.mode === "selectionNet") setCanvasState({ mode: "selectionNet", origin: state.canvasState.origin, current });
    else if (state.canvasState.mode === "inserting" && state.canvasState.origin) setCanvasState({ ...state.canvasState, current });
    else if (state.canvasState.mode === "pencil") {
      if (pencilTool === "draw") continueDrawing(current, e);
      else if (pencilTool === "erase" && e.buttons === 1) eraser(current);
    }
  }, [camera, setCursor, setCanvasState, pencilTool, translateSelectedLayers, resizeSelectedLayer, rotateSelectedLayer, continueDrawing, eraser]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const point = pointerEventToCanvasPoint(e, camera);
    const state = useCanvasStore.getState();
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

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const point = pointerEventToCanvasPoint(e, camera);
    const state = useCanvasStore.getState();
    if (state.canvasState.mode === "translating" || state.canvasState.mode === "resizing" || state.canvasState.mode === "rotating") {
      if (state.selection.length > 0) {
        const layer = state.layers[state.selection[0]];
        if (layer) addAuditEntry("modified", layer.type);
      }
      setCanvasState({ mode: "none" });
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
      setCanvasState({ mode: "none" });
    } else if (state.canvasState.mode === "inserting") {
      const { origin } = state.canvasState;
      if (origin) {
        const w = Math.abs(point.x - origin.x);
        const h = Math.abs(point.y - origin.y);
        const x = Math.min(point.x, origin.x);
        const y = Math.min(point.y, origin.y);
        if (w < 5 && h < 5) insertLayer(state.canvasState.layerType, point.x, point.y);
        else insertLayer(state.canvasState.layerType, x, y, w, h);
      }
    } else if (state.canvasState.mode === "pencil") {
      if (pencilTool === "draw") insertPath();
    }
  }, [camera, setCanvasState, setSelection, insertLayer, insertPath, addAuditEntry, pushHistory, pencilTool]);

  const onLayerPointerDown = useCallback((e: React.PointerEvent, layerId: string) => {
    e.stopPropagation();
    const point = pointerEventToCanvasPoint(e, camera);
    const state = useCanvasStore.getState();
    const layer = state.layers[layerId];
    if (layer?.locked) return;
    if (!state.selection.includes(layerId)) {
      setSelection([layerId]);
    }
    // Save pre-mutation state BEFORE translate
    state.pushHistory();
    setCanvasState({ mode: "translating", current: point });
  }, [camera, setSelection, setCanvasState]);

  const onResizeHandlePointerDown = useCallback((e: React.PointerEvent, initialBounds: any) => {
    e.stopPropagation();
    const point = pointerEventToCanvasPoint(e, camera);
    // Save pre-mutation state BEFORE resize
    useCanvasStore.getState().pushHistory();
    setCanvasState({ mode: "resizing", initialBounds, initialStart: point, corner: "bottom-right" });
  }, [camera, setCanvasState]);

  const onLayerRotatePointerDown = useCallback((e: React.PointerEvent, layerId: string) => {
    e.stopPropagation();
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

      if (e.key === "Escape") {
        if (useCanvasStore.getState().showCommandPalette) { useCanvasStore.getState().setShowCommandPalette(false); return; }
        if (showShortcuts) { setShowShortcuts(false); return; }
        setCanvasState({ mode: "none" });
        setSelection([]);
        return;
      }

      if (e.key === "?" && !isInput) {
        e.preventDefault();
        setShowShortcuts((v) => !v);
        return;
      }

      if (isInput) return;

      if ((e.ctrlKey || e.metaKey) && e.key === "c") { e.preventDefault(); copyLayers(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === "v") { e.preventDefault(); pasteLayers(); return; }

      const store = useCanvasStore.getState();
      switch (e.key) {
        case "Delete": case "Backspace": store.deleteLayers(); break;
        case "d": if (e.ctrlKey || e.metaKey) { e.preventDefault(); store.duplicateLayers(); } break;
        case "z": if (e.ctrlKey || e.metaKey) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); } break;
        case "v": if (!e.ctrlKey && !e.metaKey) setCanvasState({ mode: "none" }); break;
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

  // Space to pan
  useEffect(() => {
    let spaceDown = false;
    let startX = 0, startY = 0, startCamX = 0, startCamY = 0;
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
      startX = e.clientX; startY = e.clientY;
      const cam = useCanvasStore.getState().camera;
      startCamX = cam.x; startCamY = cam.y;
      document.body.style.cursor = "grabbing";
    }
    function onMouseMove(e: MouseEvent) {
      if (!spaceDown || startX === 0) return;
      const cam = useCanvasStore.getState().camera;
      setCamera({ x: startCamX + (e.clientX - startX), y: startCamY + (e.clientY - startY), zoom: cam.zoom });
    }
    function onMouseUp() { if (spaceDown) document.body.style.cursor = "grab"; startX = 0; }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [setCamera]);

  const bgClass =
    template === "blueprint"
      ? BLUEPRINT.canvasClass
      : "bg-neutral-100 dark:bg-neutral-900";
  let cursorStyle = "default";
  if (canvasState.mode === "pencil") cursorStyle = "none";
  else if (canvasState.mode === "inserting") cursorStyle = "crosshair";
  else if (canvasState.mode === "translating") cursorStyle = "grabbing";
  else if (canvasState.mode === "resizing") cursorStyle = "nwse-resize";
  else if (canvasState.mode === "rotating") cursorStyle = "crosshair";

  return (
    <main className={`h-full w-full relative touch-none overflow-hidden ${bgClass}`} style={{ cursor: cursorStyle }}>
      <Navbar title={title} boardId={boardId} />
      <Toolbar />
      <PencilToolbar />
      <SelectionTools camera={camera} />
      <ZoomControls />
      <BrushPreview />
      {showMinimap && <Minimap />}
      {showCommandPalette && <CommandPalette />}
      {showShortcuts && <ShortcutsHelp onClose={() => setShowShortcuts(false)} />}
      <StatusBar />
      <svg
        id="board-canvas"
        className="w-[100vw] h-[100vh]"
        style={{ contain: "layout paint" }}
        onWheel={(e) => {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const delta = -e.deltaY * 0.001;
            setCamera({ ...camera, zoom: Math.min(Math.max(camera.zoom + delta, 0.1), 5) });
          } else {
            setCamera({ x: camera.x - e.deltaX, y: camera.y - e.deltaY, zoom: camera.zoom });
          }
        }}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setCursor(null)}
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
        </defs>
        <g className="canvas-g" style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})` }}>
          {showGrid && template === "grid" && <rect x="-100000" y="-100000" width="200000" height="200000" fill="url(#grid-pattern)" />}
          {showGrid && template === "blueprint" && (
            <>
              <rect x="-100000" y="-100000" width="200000" height="200000" fill="url(#blueprint-pattern)" />
              <rect x="-100000" y="-100000" width="200000" height="200000" fill="url(#blueprint-pattern-major)" />
            </>
          )}
          {layerIds.map((id: string) => (
            <LayerPreview
              key={id}
              id={id}
              layer={layers[id]}
              onLayerPointerDown={onLayerPointerDown}
              onLayerResizePointerDown={onResizeHandlePointerDown}
              onLayerRotatePointerDown={onLayerRotatePointerDown}
              onChange={(val: string) => updateLayerText(id, val)}
              selectionColor={selection.includes(id) ? "#3b82f6" : undefined}
            />
          ))}
          {canvasState.mode === "selectionNet" && canvasState.current && (
            <rect className="fill-blue-500/5 stroke-blue-500 stroke-1" x={Math.min(canvasState.origin.x, canvasState.current.x)} y={Math.min(canvasState.origin.y, canvasState.current.y)} width={Math.abs(canvasState.origin.x - canvasState.current.x)} height={Math.abs(canvasState.origin.y - canvasState.current.y)} />
          )}
          {canvasState.mode === "inserting" && canvasState.origin && canvasState.current && (() => {
            const x = Math.min(canvasState.origin.x, canvasState.current.x);
            const y = Math.min(canvasState.origin.y, canvasState.current.y);
            const w = Math.abs(canvasState.origin.x - canvasState.current.x);
            const h = Math.abs(canvasState.origin.y - canvasState.current.y);
            if (canvasState.layerType === "Ellipse") return <ellipse className="fill-blue-500/5 stroke-blue-500 stroke-1" cx={(canvasState.origin.x + canvasState.current.x) / 2} cy={(canvasState.origin.y + canvasState.current.y) / 2} rx={w / 2} ry={h / 2} />;
            if (canvasState.layerType === "Triangle") return <polygon className="fill-blue-500/5 stroke-blue-500 stroke-1" points={`${x + w / 2},${y} ${x + w},${y + h} ${x},${y + h}`} />;
            if (canvasState.layerType === "Diamond") return <polygon className="fill-blue-500/5 stroke-blue-500 stroke-1" points={`${x + w / 2},${y} ${x + w},${y + h / 2} ${x + w / 2},${y + h} ${x},${y + h / 2}`} />;
            if (canvasState.layerType === "Arrow") return <path className="fill-blue-500/5 stroke-blue-500 stroke-1" d={`M ${x},${y + h * 0.3} L ${x + w * 0.6},${y + h * 0.3} L ${x + w * 0.6},${y} L ${x + w},${y + h * 0.5} L ${x + w * 0.6},${y + h} L ${x + w * 0.6},${y + h * 0.7} L ${x},${y + h * 0.7} Z`} />;
            return <rect className="fill-blue-500/5 stroke-blue-500 stroke-1" x={x} y={y} width={w} height={h} />;
          })()}
        </g>
      </svg>
    </main>
  );
}
