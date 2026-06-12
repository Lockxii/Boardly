import { toast } from "sonner";
import { useCanvasStore } from "@/store/canvas-store";
import {
  collectImageFilesFromDataTransfer,
  isImageFile,
  layoutImagePasteGrid,
  prepareImageFromFile,
} from "@/lib/image-insert";

export async function insertImagesAt(files: File[], point: { x: number; y: number }) {
  const images = files.filter(isImageFile);
  if (images.length === 0) {
    toast.error("Format non supporté — glisse une image (JPG, PNG, GIF, WebP…)");
    return;
  }

  const toastId = toast.loading(
    images.length === 1 ? "Ajout de l'image…" : `Ajout de ${images.length} images…`,
  );

  try {
    const prepared = await Promise.all(images.map((file) => prepareImageFromFile(file)));
    const positions = layoutImagePasteGrid(
      prepared.map((item) => ({ width: item.width, height: item.height })),
      point.x,
      point.y,
    );
    const items = prepared.map((item, index) => ({
      src: item.src,
      x: positions[index].x,
      y: positions[index].y,
      width: item.width,
      height: item.height,
    }));
    useCanvasStore.getState().insertImageLayersBatch(items);
    toast.success(
      images.length === 1 ? "Image ajoutée" : `${images.length} images ajoutées`,
      { id: toastId },
    );
  } catch {
    toast.error("Impossible d'ajouter l'image", { id: toastId });
  }
}

export function extractImageFilesFromClipboard(data: DataTransfer | null): File[] {
  if (!data) return [];
  const fromFiles = collectImageFilesFromDataTransfer(data);
  if (fromFiles.length > 0) return fromFiles;

  if (!data.items?.length) return [];
  const files: File[] = [];
  for (const item of data.items) {
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  }
  return files;
}
