"use client";

import { useCanvasStore } from "@/store/use-canvas-store";
import { useHistory, useMutation, useStorage, useOthers, useMyPresence, useSelf, Layer, LayerType, AuditEntry } from "@/liveblocks.config";
import { pointerEventToCanvasPoint } from "@/lib/utils";
import { nanoid } from "nanoid";
import { LiveObject, LiveMap, LiveList } from "@liveblocks/client";
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
    const [{ selection }, updateMyPresence] = useMyPresence();
    const history = useHistory();
    const self = useSelf();
    const pencilDraft = React.useRef<string | null>(null);
    
    // --- Actions ---

    const addAuditEntry = (storage: any, action: string, layerType: string) => {
        const auditLog = storage.get("auditLog");
        if (auditLog.length > 50) auditLog.delete(0);
        auditLog.push({
            id: nanoid(),
            userId: self?.id || "anon",
            userName: self?.info?.name || "Anonyme",
            action,
            layerType,
            timestamp: Date.now()
        });
    };

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
        addAuditEntry(storage, "created", layerType);
        setMyPresence({ selection: [layerId] }, { addToHistory: true });
        setCanvasState({ mode: "none" });
    }, [lastUsedColor, self]);

    const startDrawing = useMutation(({ storage, setMyPresence }, point: { x: number; y: number }, pressure: number) => {
        const liveLayers = storage.get("layers");
        const liveLayerIds = storage.get("layerIds");
        const layerId = nanoid();
        const layer = new LiveObject<Layer>({
            type: "Path",
            x: 0, y: 0, height: 0, width: 0, fill: lastUsedColor, strokeWidth: pencilThickness,
            points: [[point.x, point.y, pressure]]
        });
        liveLayers.set(layerId, layer);
        liveLayerIds.push(layerId);
        pencilDraft.current = layerId;
        setMyPresence({ selection: [layerId] }, { addToHistory: true });
    }, [lastUsedColor, pencilThickness]);

    const continueDrawing = useMutation(({ storage }, point: { x: number; y: number }, e: React.PointerEvent) => {
        const layerId = pencilDraft.current;
        if (!layerId) return;
        const layer = storage.get("layers").get(layerId);
        if (layer) {
            const points = layer.get("points") || [];
            points.push([point.x, point.y, e.pressure]);
            layer.update({ points: [...points] }); 
        }
    }, []);

    const eraser = useMutation(({ storage }, point: { x: number; y: number }) => {
        const liveLayers = storage.get("layers");
        const liveLayerIds = storage.get("layerIds");
        const eraserRadius = pencilThickness / 2;
        const eraserRadiusSq = eraserRadius * eraserRadius;
        const ids = liveLayerIds.toArray().reverse();
        for (const id of ids) {
            const layer = liveLayers.get(id);
            if (!layer) continue;
            const lx = layer.get("x");
            const ly = layer.get("y");
            const lw = layer.get("width");
            const lh = layer.get("height");
            if (point.x < lx - eraserRadius || point.x > lx + lw + eraserRadius || point.y < ly - eraserRadius || point.y > ly + lh + eraserRadius) continue;
            if (layer.get("type") === "Path") {
                const points = layer.get("points");
                if (points) {
                    const localX = point.x - lx;
                    const localY = point.y - ly;
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
            if (point.x >= lx - 5 && point.x <= lx + lw + 5 && point.y >= ly - 5 && point.y <= ly + lh + 5) {
                 addAuditEntry(storage, "deleted", layer.get("type"));
                 liveLayers.delete(id);
                 const index = liveLayerIds.indexOf(id);
                 if (index !== -1) liveLayerIds.delete(index);
            }
        }
    }, [pencilThickness, self]);

    const insertPath = useMutation(({ storage }) => {
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
             const newPoints = points.map(p => [p[0] - minX, p[1] - minY, p[2], p[3] ?? 0]);
             layer.update({ x: minX, y: minY, width: maxX - minX, height: maxY - minY, points: newPoints });
             addAuditEntry(storage, "created", "Tracé");
        }
        pencilDraft.current = null;
    }, [self]);

    const deleteLayers = useMutation(({ storage, setMyPresence }) => {
        const liveLayers = storage.get("layers");
        const liveLayerIds = storage.get("layerIds");
        selection.forEach(id => {
            const layer = liveLayers.get(id);
            if (layer) addAuditEntry(storage, "deleted", layer.get("type"));
            liveLayers.delete(id);
            const index = liveLayerIds.indexOf(id);
            if (index !== -1) liveLayerIds.delete(index);
        });
        setMyPresence({ selection: [] }, { addToHistory: true });
    }, [selection, self]);

    useEffect(() => {
        function onKeyDown(e: KeyboardEvent) {
            switch (e.key) {
                case "Delete":
                case "Backspace":
                    const ae = document.activeElement as HTMLElement;
                    if (ae?.tagName === "TEXTAREA" || ae?.tagName === "INPUT" || ae?.isContentEditable) return;
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
        const layer = storage.get("layers").get(self.presence.selection[0]);
        if (layer) {
             let w = Math.max(bounds.width + deltaX, 10);
             let h = Math.max(bounds.height + deltaY, 10);
             if (isShiftPressed) {
                 const ar = bounds.width / bounds.height;
                 if (Math.abs(deltaX) > Math.abs(deltaY)) h = w / ar;
                 else w = h * ar;
             }
             layer.update({ width: w, height: h });
        }
    }, [canvasState]);

    const rotateSelectedLayer = useMutation(({ storage, self }, point: { x: number; y: number }) => {
        if (canvasState.mode !== "rotating") return;
        const { centerX, centerY } = canvasState;
        const dx = point.x - centerX;
        const dy = point.y - centerY;
        let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
        const layer = storage.get("layers").get(self.presence.selection[0]);
        if (layer) layer.update({ rotation: angle });
    }, [canvasState]);

    const updateLayer = useMutation(({ storage }, id: string, newValue: string) => {
        const layer = storage.get("layers").get(id);
        if (layer) layer.update({ value: newValue });
    }, []);

    const onPointerMove = useMutation(({ setMyPresence }, e: React.PointerEvent) => {
        e.preventDefault();
        const current = pointerEventToCanvasPoint(e, camera);
        setMyPresence({ cursor: current });
        if (canvasState.mode === "translating") translateSelectedLayers(current);
        else if (canvasState.mode === "resizing") resizeSelectedLayer(current, e.shiftKey);
        else if (canvasState.mode === "rotating") rotateSelectedLayer(current);
        else if (canvasState.mode === "selectionNet") setCanvasState({ mode: "selectionNet", origin: canvasState.origin, current });
        else if (canvasState.mode === "inserting" && canvasState.origin) setCanvasState({ ...canvasState, current });
        else if (canvasState.mode === "pencil") {
            if (pencilTool === "draw") continueDrawing(current, e);
            else if (pencilTool === "erase" && e.buttons === 1) eraser(current);
        }
    }, [camera, canvasState, translateSelectedLayers, resizeSelectedLayer, rotateSelectedLayer, continueDrawing, eraser, pencilTool, setCanvasState]);

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
        if (canvasState.mode === "none") setCanvasState({ mode: "selectionNet", origin: point, current: point });
    }, [camera, canvasState, setCanvasState, startDrawing, eraser, pencilTool, history]);

    const onPointerUp = useMutation(({ storage, setMyPresence }, e) => {
        const point = pointerEventToCanvasPoint(e, camera);
        if (canvasState.mode === "translating" || canvasState.mode === "resizing" || canvasState.mode === "rotating") {
             setCanvasState({ mode: "none" });
             history.resume(); 
        } else if (canvasState.mode === "selectionNet") {
             const layers = storage.get("layers").toImmutable();
             const ids: string[] = [];
             const left = Math.min(canvasState.origin.x, point.x);
             const right = Math.max(canvasState.origin.x, point.x);
             const top = Math.min(canvasState.origin.y, point.y);
             const bottom = Math.max(canvasState.origin.y, point.y);
             for (const [id, layer] of layers) {
                 if (layer.x < right && layer.x + layer.width > left && layer.y < bottom && layer.y + layer.height > top) ids.push(id);
             }
             setMyPresence({ selection: ids });
             setCanvasState({ mode: "none" });
        } else if (canvasState.mode === "inserting") {
            const { origin } = canvasState;
            if (origin) {
                const w = Math.abs(point.x - origin.x);
                const h = Math.abs(point.y - origin.y);
                const x = Math.min(point.x, origin.x);
                const y = Math.min(point.y, origin.y);
                if (w < 5 && h < 5) insertLayer(canvasState.layerType, point);
                else insertLayer(canvasState.layerType, { x, y }, w, h);
            }
        } else if (canvasState.mode === "pencil") {
            if (pencilTool === "draw") insertPath();
            else history.resume();
        }
    }, [camera, canvasState, setCanvasState, history, insertPath, pencilTool, insertLayer]);

    const onLayerRotatePointerDown = useMutation(({ storage }, e: React.PointerEvent, layerId: string) => {
        e.stopPropagation();
        const layer = storage.get("layers").get(layerId);
        if (!layer) return;
        const centerX = layer.get("x") + layer.get("width") / 2;
        const centerY = layer.get("y") + layer.get("height") / 2;
        history.pause();
        setCanvasState({ mode: "rotating", initialAngle: layer.get("rotation") || 0, centerX, centerY });
    }, [setCanvasState, history]);

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
            <svg className="w-[100vw] h-[100vh]" onWheel={(e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); const ds = 0.001; const delta = -e.deltaY * ds; setCamera({ ...camera, zoom: Math.min(Math.max(camera.zoom + delta, 0.1), 5) }); } else { setCamera({ x: camera.x - e.deltaX, y: camera.y - e.deltaY, zoom: camera.zoom }); } }} onPointerMove={onPointerMove} onPointerLeave={() => updateMyPresence({ cursor: null })} onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
                <defs>
                    <pattern id="grid-pattern" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#cbd5e1" /></pattern>
                    <pattern id="blueprint-pattern" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1"/></pattern>
                </defs>
                <g style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})` }}>
                    {template === "grid" && <rect x="-100000" y="-100000" width="200000" height="200000" fill="url(#grid-pattern)" />}
                    {template === "blueprint" && <rect x="-100000" y="-100000" width="200000" height="200000" fill="url(#blueprint-pattern)" />}
                    {layerIds.map((id) => (
                        <LayerPreview key={id} id={id} onLayerPointerDown={useMutation(({ self, setMyPresence }, e: React.PointerEvent, lid: string) => { e.stopPropagation(); const p = pointerEventToCanvasPoint(e, camera); if (!self.presence.selection.includes(lid)) setMyPresence({ selection: [lid] }, { addToHistory: true }); history.pause(); setCanvasState({ mode: "translating", current: p }); }, [camera, history, setCanvasState])} onLayerResizePointerDown={(e, ib) => { e.stopPropagation(); const p = pointerEventToCanvasPoint(e, camera); history.pause(); setCanvasState({ mode: "resizing", initialBounds: ib, initialStart: p, corner: "bottom-right" }); }} onLayerRotatePointerDown={onLayerRotatePointerDown} onChange={(val) => updateLayer(id, val)} selectionColor={selection.includes(id) ? "#3b82f6" : undefined} />
                    ))}
                    {canvasState.mode === "selectionNet" && canvasState.current && (
                        <rect className="fill-blue-500/5 stroke-blue-500 stroke-1" x={Math.min(canvasState.origin.x, canvasState.current.x)} y={Math.min(canvasState.origin.y, canvasState.current.y)} width={Math.abs(canvasState.origin.x - canvasState.current.x)} height={Math.abs(canvasState.origin.y - canvasState.current.y)} />
                    )}
                    {canvasState.mode === "inserting" && canvasState.origin && canvasState.current && (
                        (() => {
                            const x = Math.min(canvasState.origin.x, canvasState.current.x);
                            const y = Math.min(canvasState.origin.y, canvasState.current.y);
                            const w = Math.abs(canvasState.origin.x - canvasState.current.x);
                            const h = Math.abs(canvasState.origin.y - canvasState.current.y);
                            if (canvasState.layerType === "Ellipse") return <ellipse className="fill-blue-500/5 stroke-blue-500 stroke-1" cx={(canvasState.origin.x + canvasState.current.x) / 2} cy={(canvasState.origin.y + canvasState.current.y) / 2} rx={w / 2} ry={h / 2} />;
                            if (canvasState.layerType === "Triangle") return <polygon className="fill-blue-500/5 stroke-blue-500 stroke-1" points={`${x + w / 2},${y} ${x + w},${y + h} ${x},${y + h}`} />;
                            if (canvasState.layerType === "Diamond") return <polygon className="fill-blue-500/5 stroke-blue-500 stroke-1" points={`${x + w / 2},${y} ${x + w},${y + h / 2} ${x + w / 2},${y + h} ${x},${y + h / 2}`} />;
                            if (canvasState.layerType === "Arrow") return <path className="fill-blue-500/5 stroke-blue-500 stroke-1" d={`M ${x},${y + h * 0.3} L ${x + w * 0.6},${y + h * 0.3} L ${x + w * 0.6},${y} L ${x + w},${y + h * 0.5} L ${x + w * 0.6},${y + h} L ${x + w * 0.6},${y + h * 0.7} L ${x},${y + h * 0.7} Z`} />;
                            return <rect className="fill-blue-500/5 stroke-blue-500 stroke-1" x={x} y={y} width={w} height={h} />;
                        })()
                    )}
                    <CursorsPresence />
                </g>
            </svg>
        </main>
    );
}