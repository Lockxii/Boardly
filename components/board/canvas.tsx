"use client";

import { useCanvasStore } from "@/store/use-canvas-store";
import { useHistory, useCanRedo, useCanUndo, useMutation, useStorage, useOthers, useMyPresence, Layer, LayerType } from "@/liveblocks.config";
import { pointerEventToCanvasPoint } from "@/lib/utils";
import { nanoid } from "nanoid";
import { LiveObject } from "@liveblocks/client";
import { LayerPreview } from "./layer-preview";
import { Toolbar } from "./toolbar";
import { PencilToolbar } from "./pencil-toolbar";
import { BrushPreview } from "./brush-preview";
import React, { useCallback, useMemo, useState } from "react";
import { CursorsPresence } from "./cursors-presence";

import { SelectionTools } from "./selection-tools";
import { ZoomControls } from "./zoom-controls";
import { Navbar } from "./navbar";
import { useEffect } from "react";

export function Canvas({ template, title }: { template: string, title: string }) {
    const { camera, setCamera, canvasState, setCanvasState, lastUsedColor, pencilThickness, pencilTool } = useCanvasStore();
    const layerIds = useStorage((root) => root.layerIds);
    const [presence, updateMyPresence] = useMyPresence();
    const history = useHistory();
    const pencilDraft = React.useRef<string | null>(null);
    
    // --- Actions ---

    const insertLayer = useMutation((
        { storage, setMyPresence },
        layerType: LayerType,
        position: { x: number; y: number },
        width: number = 100,
        height: number = 100
    ) => {
        const liveLayers = storage.get("layers");
        if (liveLayers.size >= 100) return;

        const liveLayerIds = storage.get("layerIds");
        const layerId = nanoid();
        const layer = new LiveObject<Layer>({
            type: layerType,
            x: position.x,
            y: position.y,
            height: height,
            width: width,
            fill: lastUsedColor,
        });

        liveLayers.set(layerId, layer);
        liveLayerIds.push(layerId);

        setMyPresence({ selection: [layerId] }, { addToHistory: true });
        setCanvasState({ mode: "none" });
    }, [lastUsedColor]);

    const startDrawing = useMutation((
        { storage, setMyPresence },
        point: { x: number; y: number },
        pressure: number
    ) => {
        const liveLayers = storage.get("layers");
        const liveLayerIds = storage.get("layerIds");
        const layerId = nanoid();
        
        const layer = new LiveObject<Layer>({
            type: "Path",
            x: 0, 
            y: 0,
            height: 0, 
            width: 0, 
            fill: lastUsedColor,
            strokeWidth: pencilThickness,
            points: [[point.x, point.y, pressure]]
        });

        liveLayers.set(layerId, layer);
        liveLayerIds.push(layerId);

        pencilDraft.current = layerId;
        setMyPresence({ selection: [layerId] }, { addToHistory: true });
    }, [lastUsedColor, pencilThickness]);

    const continueDrawing = useMutation((
        { storage, self },
        point: { x: number; y: number },
        e: React.PointerEvent
    ) => {
        const layerId = pencilDraft.current;
        if (!layerId) return;

        const liveLayers = storage.get("layers");
        const layer = liveLayers.get(layerId);
        
        if (layer) {
            const points = layer.get("points") || [];
            points.push([point.x, point.y, e.pressure]);
            layer.update({ points: [...points] }); 
        }
    }, []);

    const eraser = useMutation((
        { storage, setMyPresence },
        point: { x: number; y: number }
    ) => {
        const liveLayers = storage.get("layers");
        const liveLayerIds = storage.get("layerIds");
        const eraserRadius = pencilThickness / 2;
        const eraserRadiusSq = eraserRadius * eraserRadius;

        const ids = liveLayerIds.toArray().reverse();
        
        for (const id of ids) {
            const layer = liveLayers.get(id);
            if (!layer) continue;

            const layerX = layer.get("x");
            const layerY = layer.get("y");
            const width = layer.get("width");
            const height = layer.get("height");

            if (
                point.x < layerX - eraserRadius ||
                point.x > layerX + width + eraserRadius ||
                point.y < layerY - eraserRadius ||
                point.y > layerY + height + eraserRadius
            ) {
                continue;
            }

            if (layer.get("type") === "Path") {
                const points = layer.get("points");
                if (points) {
                    const localX = point.x - layerX;
                    const localY = point.y - layerY;
                    let changed = false;
                    const newPoints = points.map((p: number[]) => {
                        if (p.length > 3 && p[3] === 1) return p;
                        const dx = p[0] - localX;
                        const dy = p[1] - localY;
                        if ((dx * dx + dy * dy) < eraserRadiusSq) {
                            changed = true;
                            return [p[0], p[1], p[2], 1]; 
                        }
                        return p;
                    });
                    if (changed) layer.update({ points: newPoints });
                }
                continue;
            }
            
            const padding = 5; 
            if (
                point.x >= layerX - padding &&
                point.x <= layerX + width + padding &&
                point.y >= layerY - padding &&
                point.y <= layerY + height + padding
            ) {
                 liveLayers.delete(id);
                 const index = liveLayerIds.indexOf(id);
                 if (index !== -1) liveLayerIds.delete(index);
            }
        }
    }, [camera, pencilThickness]);

    const insertPath = useMutation(({ storage, self }) => {
        const layerId = pencilDraft.current;
        if (!layerId) return;
        const liveLayers = storage.get("layers");
        const layer = liveLayers.get(layerId);
        if (layer) {
             const points = layer.get("points") || [];
             if (points.length < 2) {
                 liveLayers.delete(layerId);
                 const liveLayerIds = storage.get("layerIds");
                 const index = liveLayerIds.indexOf(layerId);
                 if (index !== -1) liveLayerIds.delete(index);
                 history.resume();
                 pencilDraft.current = null;
                 return;
             }
             const xs = points.map(p => p[0]);
             const ys = points.map(p => p[1]);
             const minX = Math.min(...xs);
             const maxX = Math.max(...xs);
             const minY = Math.min(...ys);
             const maxY = Math.max(...ys);
             const width = maxX - minX;
             const height = maxY - minY;
             const newPoints = points.map(p => [p[0] - minX, p[1] - minY, p[2], p[3] ?? 0]);
             layer.update({ x: minX, y: minY, width, height, points: newPoints });
        }
        pencilDraft.current = null;
    }, []);

    const deleteLayers = useMutation(({ storage, setMyPresence }) => {
        const selection = presence.selection;
        if (!selection || selection.length === 0) return;
        const liveLayers = storage.get("layers");
        const liveLayerIds = storage.get("layerIds");
        selection.forEach(id => {
            liveLayers.delete(id);
            const index = liveLayerIds.indexOf(id);
            if (index !== -1) liveLayerIds.delete(index);
        });
        setMyPresence({ selection: [] }, { addToHistory: true });
    }, [presence.selection]);

    useEffect(() => {
        function onKeyDown(e: KeyboardEvent) {
            switch (e.key) {
                case "Delete":
                case "Backspace":
                    const activeElement = document.activeElement as HTMLElement;
                    if (activeElement?.tagName === "TEXTAREA" || activeElement?.tagName === "INPUT" || activeElement?.isContentEditable) return;
                    deleteLayers();
                    break;
                case "z":
                    if (e.ctrlKey || e.metaKey) {
                        if (e.shiftKey) history.redo();
                        else history.undo();
                        e.preventDefault();
                    }
                    break;
            }
        }
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [deleteLayers, history]);

    const translateSelectedLayers = useMutation(({ storage, self }, point: { x: number; y: number }) => {
        if (canvasState.mode !== "translating") return;
        const offset = { x: point.x - canvasState.current.x, y: point.y - canvasState.current.y };
        const liveLayers = storage.get("layers");
        for (const id of self.presence.selection) {
            const layer = liveLayers.get(id);
            if (layer) layer.update({ x: layer.get("x") + offset.x, y: layer.get("y") + offset.y });
        }
        setCanvasState({ mode: "translating", current: point });
    }, [canvasState]);

    const resizeSelectedLayer = useMutation(({ storage, self }, point: { x: number; y: number }, isShiftPressed: boolean) => {
        if (canvasState.mode !== "resizing") return;
        const bounds = canvasState.initialBounds;
        const dragStart = canvasState.initialStart;
        const deltaX = point.x - dragStart.x;
        const deltaY = point.y - dragStart.y;
        const liveLayers = storage.get("layers");
        const layer = liveLayers.get(self.presence.selection[0]);
        if (layer) {
             let width = Math.max(bounds.width + deltaX, 10);
             let height = Math.max(bounds.height + deltaY, 10);
             if (isShiftPressed) {
                 const aspectRatio = bounds.width / bounds.height;
                 if (Math.abs(deltaX) > Math.abs(deltaY)) height = width / aspectRatio;
                 else width = height * aspectRatio;
             }
             layer.update({ width, height });
        }
    }, [canvasState]);

    const rotateSelectedLayer = useMutation(({ storage, self }, point: { x: number; y: number }) => {
        if (canvasState.mode !== "rotating") return;
        const { centerX, centerY } = canvasState;
        const dx = point.x - centerX;
        const dy = point.y - centerY;
        let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
        const liveLayers = storage.get("layers");
        const layer = liveLayers.get(self.presence.selection[0]);
        if (layer) layer.update({ rotation: angle });
    }, [canvasState]);

    const updateLayer = useMutation(({ storage }, id: string, newValue: string) => {
        const liveLayers = storage.get("layers");
        const layer = liveLayers.get(id);
        if (layer) layer.update({ value: newValue });
    }, []);

    const startDrawingSelectionNet = useCallback((e: React.PointerEvent) => {
        const point = pointerEventToCanvasPoint(e, camera);
        setCanvasState({ mode: "selectionNet", origin: point, current: point });
    }, [camera, setCanvasState]);

    const updateSelectionNet = useMutation(({ storage, setMyPresence }, current: { x: number, y: number }, origin: { x: number, y: number }) => {
        setCanvasState({ mode: "selectionNet", origin, current });
    }, [setCanvasState]);

    const startMultiSelection = useMutation(({ storage, setMyPresence }, current: { x: number, y: number }, origin: { x: number, y: number }) => {
        const layers = storage.get("layers").toImmutable();
        const ids: string[] = [];
        const left = Math.min(origin.x, current.x);
        const right = Math.max(origin.x, current.x);
        const top = Math.min(origin.y, current.y);
        const bottom = Math.max(origin.y, current.y);
        for (const [layerId, layer] of layers) {
            if (layer.x < right && layer.x + layer.width > left && layer.y < bottom && layer.y + layer.height > top) ids.push(layerId);
        }
        setMyPresence({ selection: ids });
        setCanvasState({ mode: "none" });
    }, [setCanvasState]);

    const onWheel = useCallback((e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const zoomSensitivity = 0.001;
            const delta = -e.deltaY * zoomSensitivity;
            const newZoom = Math.min(Math.max(camera.zoom + delta, 0.1), 5);
            setCamera({ ...camera, zoom: newZoom });
        } else {
            setCamera({ x: camera.x - e.deltaX, y: camera.y - e.deltaY, zoom: camera.zoom });
        }
    }, [camera, setCamera]);

    const onPointerMove = useMutation(({ setMyPresence }, e: React.PointerEvent) => {
        e.preventDefault();
        const current = pointerEventToCanvasPoint(e, camera);
        setMyPresence({ cursor: current });
        if (canvasState.mode === "translating") translateSelectedLayers(current);
        else if (canvasState.mode === "resizing") resizeSelectedLayer(current, e.shiftKey);
        else if (canvasState.mode === "rotating") rotateSelectedLayer(current);
        else if (canvasState.mode === "selectionNet") updateSelectionNet(current, canvasState.origin);
        else if (canvasState.mode === "inserting" && canvasState.origin) setCanvasState({ ...canvasState, current });
        else if (canvasState.mode === "pencil") {
            if (pencilTool === "draw") continueDrawing(current, e);
            else if (pencilTool === "erase" && e.buttons === 1) eraser(current);
        }
    }, [camera, canvasState, translateSelectedLayers, resizeSelectedLayer, rotateSelectedLayer, updateSelectionNet, continueDrawing, eraser, pencilTool, setCanvasState]);

    const onPointerLeave = useMutation(({ setMyPresence }) => {
        setMyPresence({ cursor: null });
    }, []);

    const onPointerDown = useCallback((e: React.PointerEvent) => {
        const point = pointerEventToCanvasPoint(e, camera);
        if (canvasState.mode === "inserting") {
            setCanvasState({ ...canvasState, origin: point, current: point });
            return;
        }
        if (canvasState.mode === "pencil") {
            if (pencilTool === "draw") startDrawing(point, e.pressure);
            else { history.pause(); eraser(point); }
            return;
        }
        if (canvasState.mode === "none") startDrawingSelectionNet(e);
    }, [camera, canvasState, setCanvasState, startDrawingSelectionNet, startDrawing, eraser, pencilTool, history]);

    const onLayerPointerDown = useMutation(({ self, setMyPresence }, e: React.PointerEvent, layerId: string) => {
        e.stopPropagation();
        const point = pointerEventToCanvasPoint(e, camera);
        if (!self.presence.selection.includes(layerId)) setMyPresence({ selection: [layerId] }, { addToHistory: true });
        history.pause();
        setCanvasState({ mode: "translating", current: point });
    }, [camera, setCanvasState, history]);

    const onLayerRotatePointerDown = useMutation(({ storage }, e: React.PointerEvent, layerId: string) => {
        e.stopPropagation();
        const layer = storage.get("layers").get(layerId);
        if (!layer) return;
        const centerX = layer.get("x") + layer.get("width") / 2;
        const centerY = layer.get("y") + layer.get("height") / 2;
        history.pause();
        setCanvasState({ mode: "rotating", initialAngle: layer.get("rotation") || 0, centerX, centerY });
    }, [setCanvasState, history]);

    const onResizeHandlePointerDown = useCallback((e: React.PointerEvent, initialBounds: any) => {
        e.stopPropagation();
        const point = pointerEventToCanvasPoint(e, camera);
        history.pause(); 
        setCanvasState({ mode: "resizing", initialBounds, initialStart: point, corner: "bottom-right" });
    }, [camera, setCanvasState, history]);

    const onPointerUp = useMutation(({}, e) => {
        const point = pointerEventToCanvasPoint(e, camera);
        if (canvasState.mode === "translating" || canvasState.mode === "resizing" || canvasState.mode === "rotating") {
             setCanvasState({ mode: "none" });
             history.resume(); 
        } else if (canvasState.mode === "selectionNet") startMultiSelection(point, canvasState.origin);
        else if (canvasState.mode === "inserting") {
            const { origin } = canvasState;
            if (origin) {
                const width = Math.abs(point.x - origin.x);
                const height = Math.abs(point.y - origin.y);
                const x = Math.min(point.x, origin.x);
                const y = Math.min(point.y, origin.y);
                if (width < 5 && height < 5) insertLayer(canvasState.layerType, point);
                else insertLayer(canvasState.layerType, { x, y }, width, height);
            }
        } else if (canvasState.mode === "pencil") {
            if (pencilTool === "draw") insertPath();
            else history.resume();
        }
    }, [camera, canvasState, setCanvasState, history, startMultiSelection, insertPath, pencilTool, insertLayer]);

    if (!layerIds) return null;
    const bgClass = template === "blueprint" ? "bg-[#1e40af]" : "bg-neutral-100 dark:bg-neutral-900";
    let cursorStyle = "default";
    if (canvasState.mode === "pencil") cursorStyle = "none";
    else if (canvasState.mode === "inserting") cursorStyle = "crosshair";
    else if (canvasState.mode === "translating") cursorStyle = "grabbing";
    else if (canvasState.mode === "resizing") cursorStyle = "nwse-resize";
    else if (canvasState.mode === "rotating") cursorStyle = "crosshair";

    return (
        <main className={`h-full w-full relative touch-none overflow-hidden ${bgClass}`} style={{ cursor: cursorStyle }}>
            <Navbar title={title} />
            <Toolbar />
            <PencilToolbar />
            <SelectionTools camera={camera} />
            <ZoomControls />
            <BrushPreview />
            <svg className="w-[100vw] h-[100vh]" onWheel={onWheel} onPointerMove={onPointerMove} onPointerLeave={onPointerLeave} onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
                <defs>
                    <pattern id="grid-pattern" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#cbd5e1" /></pattern>
                    <pattern id="blueprint-pattern" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1"/></pattern>
                </defs>
                <g style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})` }}>
                    {template === "grid" && <rect x="-100000" y="-100000" width="200000" height="200000" fill="url(#grid-pattern)" />}
                    {template === "blueprint" && <rect x="-100000" y="-100000" width="200000" height="200000" fill="url(#blueprint-pattern)" />}
                    {layerIds.map((id) => (
                        <LayerPreview key={id} id={id} onLayerPointerDown={onLayerPointerDown} onLayerResizePointerDown={onResizeHandlePointerDown} onLayerRotatePointerDown={onLayerRotatePointerDown} onChange={(val) => updateLayer(id, val)} selectionColor={presence.selection.includes(id) ? "#3b82f6" : undefined} />
                    ))}
                    {canvasState.mode === "selectionNet" && canvasState.current && (
                        <rect className="fill-blue-500/5 stroke-blue-500 stroke-1" x={Math.min(canvasState.origin.x, canvasState.current.x)} y={Math.min(canvasState.origin.y, canvasState.current.y)} width={Math.abs(canvasState.origin.x - canvasState.current.x)} height={Math.abs(canvasState.origin.y - canvasState.current.y)} />
                    )}
                    {canvasState.mode === "inserting" && canvasState.origin && canvasState.current && (
                        (() => {
                            const x = Math.min(canvasState.origin.x, canvasState.current.x);
                            const y = Math.min(canvasState.origin.y, canvasState.current.y);
                            const width = Math.abs(canvasState.origin.x - canvasState.current.x);
                            const height = Math.abs(canvasState.origin.y - canvasState.current.y);
                            if (canvasState.layerType === "Ellipse") return <ellipse className="fill-blue-500/5 stroke-blue-500 stroke-1" cx={(canvasState.origin.x + canvasState.current.x) / 2} cy={(canvasState.origin.y + canvasState.current.y) / 2} rx={width / 2} ry={height / 2} />;
                            if (canvasState.layerType === "Triangle") return <polygon className="fill-blue-500/5 stroke-blue-500 stroke-1" points={`${x + width / 2},${y} ${x + width},${y + height} ${x},${y + height}`} />;
                            if (canvasState.layerType === "Diamond") return <polygon className="fill-blue-500/5 stroke-blue-500 stroke-1" points={`${x + width / 2},${y} ${x + width},${y + height / 2} ${x + width / 2},${y + height} ${x},${y + height / 2}`} />;
                            if (canvasState.layerType === "Arrow") return <path className="fill-blue-500/5 stroke-blue-500 stroke-1" d={`M ${x},${y + height * 0.3} L ${x + width * 0.6},${y + height * 0.3} L ${x + width * 0.6},${y} L ${x + width},${y + height * 0.5} L ${x + width * 0.6},${y + height} L ${x + width * 0.6},${y + height * 0.7} L ${x},${y + height * 0.7} Z`} />;
                            return <rect className="fill-blue-500/5 stroke-blue-500 stroke-1" x={x} y={y} width={width} height={height} />;
                        })()
                    )}
                    <CursorsPresence />
                </g>
            </svg>
        </main>
    );
}
