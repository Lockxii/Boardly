import { beforeEach, describe, expect, it } from "vitest";

// undo()/redo() call flashLayers, which uses window.setTimeout. Provide a
// minimal window so the dual-stack history can be tested without a DOM.
(globalThis as unknown as { window?: unknown }).window ??= globalThis;

import { useCanvasStore } from "./canvas-store";

function reset() {
  useCanvasStore.setState({
    layers: {},
    layerIds: [],
    selection: [],
    undoStack: [],
    redoStack: [],
    auditLog: [],
    highlightedLayerIds: [],
  });
}

describe("canvas-store undo/redo (dual-stack history)", () => {
  beforeEach(reset);

  it("round-trips insert → undo → redo", () => {
    const id = useCanvasStore.getState().insertLayer("Rectangle", 10, 20);
    expect(id).toBeTruthy();
    expect(useCanvasStore.getState().layerIds).toEqual([id]);

    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().layerIds).toEqual([]);
    expect(useCanvasStore.getState().layers).toEqual({});

    useCanvasStore.getState().redo();
    expect(useCanvasStore.getState().layerIds).toEqual([id]);
    expect(useCanvasStore.getState().layers[id!]).toMatchObject({ type: "Rectangle", x: 10, y: 20 });
  });

  it("a new mutation clears the redo stack", () => {
    useCanvasStore.getState().insertLayer("Rectangle", 0, 0);
    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().redoStack).toHaveLength(1);

    useCanvasStore.getState().insertLayer("Ellipse", 5, 5);
    expect(useCanvasStore.getState().redoStack).toHaveLength(0);
  });

  it("undo on an empty stack is a no-op", () => {
    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().layerIds).toEqual([]);
    expect(useCanvasStore.getState().redoStack).toHaveLength(0);
  });

  it("deleteLayers can be undone", () => {
    const id = useCanvasStore.getState().insertLayer("Note", 0, 0)!;
    useCanvasStore.getState().deleteLayers([id]);
    expect(useCanvasStore.getState().layerIds).toEqual([]);

    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().layerIds).toEqual([id]);
  });

  it("layer updates can opt into undo history", () => {
    const id = useCanvasStore.getState().insertLayer("Rectangle", 0, 0)!;
    useCanvasStore.getState().updateLayer(id, { fill: "#ff0000" }, { history: true });
    expect(useCanvasStore.getState().layers[id].fill).toBe("#ff0000");

    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().layers[id].fill).toBe("#000000");
  });
});
