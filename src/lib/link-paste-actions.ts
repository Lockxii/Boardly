import { toast } from "sonner";
import { apiFetch } from "@/lib/utils";
import type { LinkPreview } from "@/lib/types";
import { useCanvasStore } from "@/store/canvas-store";
import { buildFallbackLinkPreview, layoutLinkPasteGrid } from "@/lib/link-paste";
import { getLinkLayerDimensions } from "@/lib/brand-icons";

export async function fetchLinkPreview(url: string): Promise<LinkPreview> {
  try {
    return await apiFetch<LinkPreview>(`/api/link-preview?url=${encodeURIComponent(url)}`);
  } catch {
    return buildFallbackLinkPreview(url);
  }
}

export async function pasteUrlsAt(urls: string[], point: { x: number; y: number }) {
  const unique = [...new Set(urls.map((u) => u.trim()).filter(Boolean))];
  if (unique.length === 0) return;

  const toastId = toast.loading(
    unique.length === 1 ? "Récupération de l'aperçu…" : `Import de ${unique.length} liens…`,
  );

  try {
    const previews = await Promise.all(unique.map(fetchLinkPreview));
    const items = layoutLinkPasteGrid(previews, point.x, point.y);
    useCanvasStore.getState().insertLinkLayersBatch(
      items.map(({ preview, x, y }) => ({ preview, x, y })),
    );
    toast.success(unique.length === 1 ? "Lien collé" : `${unique.length} liens ajoutés`, { id: toastId });
  } catch {
    toast.error("Impossible d'importer les liens", { id: toastId });
  }
}

export function getDefaultPastePoint(camera: { x: number; y: number; zoom: number }) {
  return {
    x: (window.innerWidth / 2 - camera.x) / camera.zoom,
    y: (window.innerHeight / 2 - camera.y) / camera.zoom,
  };
}

export async function refreshLinkLayerPreview(id: string) {
  const store = useCanvasStore.getState();
  const layer = store.layers[id];
  if (!layer || layer.type !== "Link" || !layer.url?.trim()) return;

  const toastId = toast.loading("Actualisation de l'aperçu…");
  try {
    const preview = await fetchLinkPreview(layer.url.trim());
    store.pushHistory();
    const { width, height } = getLinkLayerDimensions(preview);
    store.updateLayer(id, {
      width,
      height,
      url: preview.url,
      linkTitle: preview.title,
      linkDescription: preview.description,
      linkImage: preview.image,
      linkProvider: preview.provider || "generic",
      linkAuthor: preview.author,
      linkImageWidth: preview.imageWidth,
      linkImageHeight: preview.imageHeight,
      linkVideoId: preview.videoId,
      linkVideoSrc: preview.videoSrc,
      linkMediaType: preview.mediaType,
    });
    toast.success("Aperçu actualisé", { id: toastId });
  } catch {
    toast.error("Impossible d'actualiser ce lien", { id: toastId });
  }
}
