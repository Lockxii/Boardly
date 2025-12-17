"use client";

import { useCanvasStore } from "@/store/use-canvas-store";
import { useHistory, useCanRedo, useCanUndo, useMutation, useStorage, useOthers, useMyPresence, Layer, LayerType } from "@/liveblocks.config";
import { pointerEventToCanvasPoint } from "@/lib/utils";
import { nanoid } from "nanoid";
import { LiveObject } from "@liveblocks/client";
import { LayerPreview } from "./layer-preview";
import { Toolbar } from "./toolbar";
import React, { useCallback, useMemo, useState } from "react";
import { CursorsPresence } from "./cursors-presence";

import { SelectionTools } from "./selection-tools";
import { ZoomControls } from "./zoom-controls";
import { useEffect } from "react";

export function Canvas({ template }: { template: string }) {
    const { camera, setCamera, canvasState, setCanvasState, lastUsedColor } = useCanvasStore();
    const layerIds = useStorage((root) => root.layerIds);
    const [presence, updateMyPresence] = useMyPresence();
    const history = useHistory();
    
    // --- Actions ---

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

    // Keyboard listener for Delete
    useEffect(() => {
        function onKeyDown(e: KeyboardEvent) {
            switch (e.key) {
                case "Delete":
                case "Backspace":
                    // Don't delete if editing text
                    if (document.activeElement?.tagName === "TEXTAREA" || document.activeElement?.tagName === "INPUT") {
                        return;
                    }
                    deleteLayers();
                    break;
                case "z":
                    if (e.ctrlKey || e.metaKey) {
                        if (e.shiftKey) {
                            history.redo();
                        } else {
                            history.undo();
                        }
                        e.preventDefault();
                    }
                    break;
            }
        }

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [deleteLayers, history]);

    const insertLayer = useMutation((
        { storage, setMyPresence },
        layerType: LayerType,
        position: { x: number; y: number }
    ) => {
        const liveLayers = storage.get("layers");
        if (liveLayers.size >= 100) return; // Limit for demo

        const liveLayerIds = storage.get("layerIds");
        const layerId = nanoid();
        const layer = new LiveObject<Layer>({ // Explicit type
            type: layerType,
            x: position.x,
            y: position.y,
            height: 100,
            width: 100,
            fill: lastUsedColor,
        });

        liveLayers.set(layerId, layer);
        liveLayerIds.push(layerId);

        setMyPresence({ selection: [layerId] }, { addToHistory: true });
        setCanvasState({ mode: "none" });
    }, [lastUsedColor]);

    const translateSelectedLayers = useMutation((
        { storage, self },
        point: { x: number; y: number }
    ) => {
        if (canvasState.mode !== "translating") return;

        const offset = {
            x: point.x - canvasState.current.x,
            y: point.y - canvasState.current.y,
        };

        const liveLayers = storage.get("layers");

        for (const id of self.presence.selection) {
            const layer = liveLayers.get(id);
            if (layer) {
                layer.update({
                    x: layer.get("x") + offset.x,
                    y: layer.get("y") + offset.y,
                });
            }
        }

        setCanvasState({ mode: "translating", current: point });
    }, [canvasState]);

    const unselectLayers = useMutation((
        { setMyPresence }
    ) => {
        setMyPresence({ selection: [] }, { addToHistory: true });
    }, []);

    const updateLayer = useMutation((
        { storage },
        id: string,
        newValue: string
    ) => {
        const liveLayers = storage.get("layers");
        const layer = liveLayers.get(id);
        if (layer) {
            layer.update({ value: newValue });
        }
    }, []);

    const resizeSelectedLayer = useMutation((
        { storage, self },
        point: { x: number; y: number },
        isShiftPressed: boolean
    ) => {
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
                 // Determine dominant axis or just sync height to width
                 // Simple approach: Use width to drive height
                 if (Math.abs(deltaX) > Math.abs(deltaY)) {
                     height = width / aspectRatio;
                 } else {
                     width = height * aspectRatio;
                 }
             }

             layer.update({ width, height });
        }
    }, [canvasState]);


    const startDrawingSelectionNet = useCallback((e: React.PointerEvent) => {
        const point = pointerEventToCanvasPoint(e, camera);
        setCanvasState({ mode: "selectionNet", origin: point, current: point });
    }, [camera, setCanvasState]);

    const updateSelectionNet = useMutation((
        { storage, setMyPresence },
        current: { x: number, y: number },
        origin: { x: number, y: number }
    ) => {
        const layers = storage.get("layers").toImmutable();
        setCanvasState({
            mode: "selectionNet",
            origin,
            current,
        });

        const ids: string[] = [];
        setMyPresence({ selection: ids });
    }, [setCanvasState]);

    const startMultiSelection = useMutation((
        { storage, setMyPresence },
        current: { x: number, y: number },
        origin: { x: number, y: number }
    ) => {
        const layers = storage.get("layers").toImmutable();
        const ids: string[] = [];

        // Normalize selection box
        const left = Math.min(origin.x, current.x);
        const right = Math.max(origin.x, current.x);
        const top = Math.min(origin.y, current.y);
        const bottom = Math.max(origin.y, current.y);

        for (const [layerId, layer] of layers) {
            // Check intersection (AABB)
            if (
                layer.x < right &&
                layer.x + layer.width > left &&
                layer.y < bottom &&
                layer.y + layer.height > top
            ) {
                ids.push(layerId);
            }
        }

        setMyPresence({ selection: ids });
        setCanvasState({ mode: "none" });
    }, [setCanvasState]);


    // --- Event Handlers ---

    const onWheel = useCallback((e: React.WheelEvent) => {
        // Zoom on Ctrl + Wheel
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault(); // Stop browser zoom
            
            const zoomSensitivity = 0.001; // Adjust based on feel
            const delta = -e.deltaY * zoomSensitivity;
            const newZoom = Math.min(Math.max(camera.zoom + delta, 0.1), 5);
            
            // Calculate zoom relative to pointer position to keep it centered
            // Logic: The point under the mouse should stay under the mouse
            // However, implementing full relative zoom in this simple handler requires
            // untransforming the mouse point. For simplicity/stability in this iteration,
            // we zoom to center or just updated zoom, but proper implementation is:
            
            // 1. Get mouse pos in canvas space BEFORE zoom
            // 2. Apply new zoom
            // 3. Adjust camera x/y so that the point is still at mouse pos
            
            // Simplified: Just zoom center for now or let users pan
            setCamera({
                ...camera,
                zoom: newZoom
            });
        } else {
            // Pan on Wheel
            setCamera({
                x: camera.x - e.deltaX,
                y: camera.y - e.deltaY,
                zoom: camera.zoom
            });
        }
    }, [camera, setCamera]);

    const onPointerMove = useMutation(({ setMyPresence }, e: React.PointerEvent) => {
        e.preventDefault();
        const current = pointerEventToCanvasPoint(e, camera);
        
        setMyPresence({ cursor: current });

        if (canvasState.mode === "translating") {
            translateSelectedLayers(current);
        } else if (canvasState.mode === "resizing") {
            resizeSelectedLayer(current);
        } else if (canvasState.mode === "selectionNet") {
            updateSelectionNet(current, canvasState.origin);
        }
    }, [camera, canvasState, translateSelectedLayers, resizeSelectedLayer, updateSelectionNet]);

    const onPointerLeave = useMutation(({ setMyPresence }) => {
        setMyPresence({ cursor: null });
    }, []);

    const onPointerDown = useCallback((e: React.PointerEvent) => {
        const point = pointerEventToCanvasPoint(e, camera);

        if (canvasState.mode === "inserting") {
            insertLayer(canvasState.layerType, point);
            return;
        }

        // Clicking on canvas deselects and starts selection net
        if (canvasState.mode === "none") {
            startDrawingSelectionNet(e);
        }
    }, [camera, canvasState, insertLayer, setCanvasState, startDrawingSelectionNet]);

    const onLayerPointerDown = useMutation((
        { self, setMyPresence },
        e: React.PointerEvent,
        layerId: string
    ) => {
        e.stopPropagation();
        const point = pointerEventToCanvasPoint(e, camera);

        if (!self.presence.selection.includes(layerId)) {
            setMyPresence({ selection: [layerId] }, { addToHistory: true });
        }
        
        history.pause(); // Start batching history
        setCanvasState({ mode: "translating", current: point });
    }, [camera, setCanvasState, history]);

    const onResizeHandlePointerDown = useCallback((e: React.PointerEvent, initialBounds: any) => {
        e.stopPropagation();
        const point = pointerEventToCanvasPoint(e, camera);
        history.pause(); // Start batching history
        setCanvasState({ 
            mode: "resizing", 
            initialBounds, 
            initialStart: point, 
            corner: "bottom-right" 
        });
    }, [camera, setCanvasState, history]);

    const onPointerUp = useMutation(({}, e) => {
        const point = pointerEventToCanvasPoint(e, camera);
        
        if (canvasState.mode === "translating" || canvasState.mode === "resizing") {
             setCanvasState({ mode: "none" });
             history.resume(); // End batching history
        } else if (canvasState.mode === "selectionNet") {
             startMultiSelection(point, canvasState.origin);
        }
    }, [camera, canvasState, setCanvasState, history, startMultiSelection]);

    if (!layerIds) return null;

    const bgClass = template === "blueprint" ? "bg-[#1e40af]" : "bg-neutral-100 dark:bg-neutral-900";

    return (
        <main className={`h-full w-full relative touch-none overflow-hidden ${bgClass}`}>
            <Toolbar />
            <SelectionTools camera={camera} />
            <ZoomControls />
            <div className="absolute top-4 right-4 z-10">
                 {/* <CursorsPresence /> moved inside SVG */}
            </div>

            <svg
                className="w-[100vw] h-[100vh]"
                onWheel={onWheel}
                onPointerMove={onPointerMove}
                onPointerLeave={onPointerLeave}
                onPointerDown={onPointerDown}
                onPointerUp={onPointerUp}
            >
                <defs>
                    {/* Grid Pattern */}
                    <pattern id="grid-pattern" width="20" height="20" patternUnits="userSpaceOnUse">
                        <circle cx="1" cy="1" r="1" fill="#cbd5e1" />
                    </pattern>
                    
                    {/* Blueprint Pattern */}
                    <pattern id="blueprint-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
                         <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1"/>
                    </pattern>
                </defs>

                <g
                    style={{
                        transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
                    }}
                >
                    {/* Backgrounds */}
                    {template === "grid" && (
                        <rect x="-100000" y="-100000" width="200000" height="200000" fill="url(#grid-pattern)" />
                    )}
                    {template === "blueprint" && (
                        <rect x="-100000" y="-100000" width="200000" height="200000" fill="url(#blueprint-pattern)" />
                    )}

                    {layerIds.map((layerId) => (
                        <LayerPreview
                            key={layerId}
                            id={layerId}
                            onLayerPointerDown={onLayerPointerDown}
                            onLayerResizePointerDown={onResizeHandlePointerDown}
                            onChange={(newValue) => updateLayer(layerId, newValue)}
                            selectionColor={presence.selection.includes(layerId) ? "#3b82f6" : undefined}
                        />
                    ))}
                    
                    {/* Selection Net Visual */}
                    {canvasState.mode === "selectionNet" && canvasState.current && (
                        <rect
                            className="fill-blue-500/5 stroke-blue-500 stroke-1"
                            x={Math.min(canvasState.origin.x, canvasState.current.x)}
                            y={Math.min(canvasState.origin.y, canvasState.current.y)}
                            width={Math.abs(canvasState.origin.x - canvasState.current.x)}
                            height={Math.abs(canvasState.origin.y - canvasState.current.y)}
                        />
                    )}

                    <CursorsPresence />
                </g>
            </svg>
        </main>
    );
}