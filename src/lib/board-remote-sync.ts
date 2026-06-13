import { toast } from "sonner";
import { serializeCanvasDataSnapshot, useCanvasStore } from "@/store/canvas-store";
import type { BoardCanvasData } from "@/lib/types";

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
