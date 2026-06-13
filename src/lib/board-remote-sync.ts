import { toast } from "sonner";
import { serializeCanvasDataSnapshot, useCanvasStore } from "@/store/canvas-store";
import type {
  AuditEntry,
  BoardCanvasData,
  BoardConnection,
  CanvasVersion,
  ChatMessage,
  Layer,
  LayerComment,
  LayerReaction,
  TrashEntry,
} from "@/lib/types";

export type BoardLivePatch = {
  revision: number;
  updatedAt: string;
  layers?: Record<string, Layer>;
  deletedLayerIds?: string[];
  layerIds?: string[];
  connections?: BoardConnection[];
  versions?: CanvasVersion[];
  auditLog?: AuditEntry[];
  chatMessages?: ChatMessage[];
  layerComments?: Record<string, LayerComment[]>;
  reactions?: Record<string, LayerReaction[]>;
  trash?: TrashEntry[];
  brandColors?: string[];
};

function sameJson(a: unknown, b: unknown) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function mergeLayerOrder(remoteOrder: string[], previousOrder: string[], layers: Record<string, Layer>) {
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const id of remoteOrder) {
    if (!layers[id] || seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);
  }

  for (const id of previousOrder) {
    if (!layers[id] || seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);
  }

  for (const id of Object.keys(layers)) {
    if (seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);
  }

  return ordered;
}

export function createBoardLivePatch(previous: BoardCanvasData, next: BoardCanvasData, revision: number): BoardLivePatch | null {
  const patch: BoardLivePatch = {
    revision,
    updatedAt: new Date().toISOString(),
  };
  let changed = false;

  const layerUpdates: Record<string, Layer> = {};
  for (const [id, layer] of Object.entries(next.layers)) {
    if (!sameJson(previous.layers[id], layer)) layerUpdates[id] = layer;
  }
  if (Object.keys(layerUpdates).length > 0) {
    patch.layers = layerUpdates;
    changed = true;
  }

  const deletedLayerIds = Object.keys(previous.layers).filter((id) => !next.layers[id]);
  if (deletedLayerIds.length > 0) {
    patch.deletedLayerIds = deletedLayerIds;
    changed = true;
  }

  if (!sameJson(previous.layerIds, next.layerIds)) {
    patch.layerIds = next.layerIds;
    changed = true;
  }

  if (!sameJson(previous.connections || [], next.connections || [])) {
    patch.connections = next.connections || [];
    changed = true;
  }
  if (!sameJson(previous.versions || [], next.versions || [])) {
    patch.versions = next.versions || [];
    changed = true;
  }
  if (!sameJson(previous.auditLog || [], next.auditLog || [])) {
    patch.auditLog = next.auditLog || [];
    changed = true;
  }
  if (!sameJson(previous.chatMessages || [], next.chatMessages || [])) {
    patch.chatMessages = next.chatMessages || [];
    changed = true;
  }
  if (!sameJson(previous.layerComments || {}, next.layerComments || {})) {
    patch.layerComments = next.layerComments || {};
    changed = true;
  }
  if (!sameJson(previous.reactions || {}, next.reactions || {})) {
    patch.reactions = next.reactions || {};
    changed = true;
  }
  if (!sameJson(previous.trash || [], next.trash || [])) {
    patch.trash = next.trash || [];
    changed = true;
  }
  if (!sameJson(previous.brandColors || [], next.brandColors || [])) {
    patch.brandColors = next.brandColors || [];
    changed = true;
  }

  return changed ? patch : null;
}

export function applyLiveBoardPatch(
  patch: BoardLivePatch,
  options: { userId?: string; userName?: string; notify?: boolean; preserveSelection?: boolean; protectedLayerIds?: string[] } = {}
) {
  if (!Number.isFinite(patch.revision)) return false;

  const state = useCanvasStore.getState();
  const protectedLayerIds = new Set(options.protectedLayerIds || []);
  const nextState: Partial<ReturnType<typeof useCanvasStore.getState>> = {};
  let nextLayers = state.layers;
  let layersChanged = false;
  const changedIds: string[] = [];

  if (patch.deletedLayerIds?.length) {
    for (const id of patch.deletedLayerIds) {
      if (protectedLayerIds.has(id) || !nextLayers[id]) continue;
      if (!layersChanged) nextLayers = { ...nextLayers };
      delete nextLayers[id];
      layersChanged = true;
    }
  }

  if (patch.layers) {
    for (const [id, layer] of Object.entries(patch.layers)) {
      if (protectedLayerIds.has(id)) continue;
      if (sameJson(nextLayers[id], layer)) continue;
      if (!layersChanged) nextLayers = { ...nextLayers };
      nextLayers[id] = layer;
      layersChanged = true;
      changedIds.push(id);
    }
  }

  if (layersChanged) {
    nextState.layers = nextLayers;
    nextState.selection = options.preserveSelection !== false ? state.selection.filter((id) => !!nextLayers[id]) : [];
  }

  if (patch.layerIds) {
    const nextLayerIds = mergeLayerOrder(patch.layerIds, state.layerIds, nextLayers);
    if (!sameJson(state.layerIds, nextLayerIds)) nextState.layerIds = nextLayerIds;
  } else if (layersChanged) {
    const nextLayerIds = mergeLayerOrder(state.layerIds, [], nextLayers);
    if (!sameJson(state.layerIds, nextLayerIds)) nextState.layerIds = nextLayerIds;
  }

  if (patch.connections !== undefined) {
    nextState.connections = patch.connections.filter((connection) => nextLayers[connection.fromId] && nextLayers[connection.toId]);
  }
  if (patch.versions !== undefined) nextState.versions = patch.versions;
  if (patch.auditLog !== undefined) nextState.auditLog = patch.auditLog;
  if (patch.chatMessages !== undefined) nextState.chatMessages = patch.chatMessages;
  if (patch.layerComments !== undefined) nextState.layerComments = patch.layerComments;
  if (patch.reactions !== undefined) nextState.reactions = patch.reactions;
  if (patch.trash !== undefined) nextState.trash = patch.trash;
  if (patch.brandColors !== undefined) nextState.brandColors = patch.brandColors;

  if (Object.keys(nextState).length === 0) return false;
  useCanvasStore.setState(nextState);

  if (changedIds.length > 0) {
    useCanvasStore.getState().flashLayers(changedIds.slice(0, 10));
    if (options.notify !== false) {
      const who = options.userName?.trim();
      toast.message(who ? `${who} a mis à jour le board` : "Le board a été mis à jour");
    }
  }

  return true;
}

export async function applyRemoteBoardUpdate(
  remote: { canvasData: BoardCanvasData | null; updatedAt: string },
  options: { userId?: string; userName?: string; notify?: boolean; preserveSelection?: boolean } = {}
) {
  const updatedAt = new Date(remote.updatedAt).getTime();
  const state = useCanvasStore.getState();
  if (state.saveStatus === "saving") return false;
  if (!remote.canvasData || !Array.isArray(remote.canvasData.layerIds)) return false;

  const prevLayers = state.layers;
  const nextLayers = remote.canvasData.layers;
  const changedIds = remote.canvasData.layerIds.filter((id) => {
    const before = prevLayers[id];
    const after = nextLayers[id];
    if (!before || !after) return !!after;
    return (
      before.x !== after.x ||
      before.y !== after.y ||
      before.value !== after.value ||
      before.fill !== after.fill
    );
  }).slice(0, 10);

  useCanvasStore.setState({
    layers: nextLayers,
    layerIds: remote.canvasData.layerIds,
    connections: remote.canvasData.connections || [],
    versions: remote.canvasData.versions || [],
    auditLog: remote.canvasData.auditLog || [],
    chatMessages: remote.canvasData.chatMessages || [],
    layerComments: remote.canvasData.layerComments || {},
    reactions: remote.canvasData.reactions || {},
    trash: remote.canvasData.trash || [],
    brandColors: remote.canvasData.brandColors || useCanvasStore.getState().brandColors,
    selection: options.preserveSelection ? state.selection.filter((id) => !!nextLayers[id]) : [],
    saveStatus: "saved",
    lastSavedAt: updatedAt,
    lastPersistedSnapshot: serializeCanvasDataSnapshot(remote.canvasData),
  });

  if (changedIds.length > 0) {
    useCanvasStore.getState().flashLayers(changedIds);
    if (options.notify !== false) {
      const who = options.userName?.trim();
      toast.message(who ? `${who} a mis à jour le board` : "Le board a été mis à jour");
    }
  }

  return true;
}
