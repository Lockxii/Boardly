import { extractUrlsFromText, extractUrlsFromClipboard } from "@/lib/clipboard-utils";
import { collectImageFilesFromDataTransfer, isImageFile } from "@/lib/image-insert";

export type DropPreviewKind = "images" | "urls" | "mixed" | null;

export function screenToCanvasPoint(
  clientX: number,
  clientY: number,
  camera: { x: number; y: number; zoom: number },
) {
  return {
    x: (clientX - camera.x) / camera.zoom,
    y: (clientY - camera.y) / camera.zoom,
  };
}

export function extractDropPayload(dataTransfer: DataTransfer | null): {
  urls: string[];
  imageFiles: File[];
} {
  if (!dataTransfer) return { urls: [], imageFiles: [] };

  const urls = new Set(extractUrlsFromClipboard(dataTransfer));
  const uriList = dataTransfer.getData("text/uri-list");
  if (uriList) {
    for (const url of extractUrlsFromText(uriList)) urls.add(url);
  }

  return { urls: [...urls], imageFiles: collectImageFilesFromDataTransfer(dataTransfer) };
}

export function getDropPreviewKind(dataTransfer: DataTransfer | null): DropPreviewKind {
  if (!dataTransfer) return null;
  const { urls, imageFiles } = extractDropPayload(dataTransfer);
  if (imageFiles.length > 0 && urls.length > 0) return "mixed";
  if (imageFiles.length > 0) return "images";
  if (urls.length > 0) return "urls";
  return null;
}

export function getDropPreviewLabel(dataTransfer: DataTransfer | null) {
  const { urls, imageFiles } = extractDropPayload(dataTransfer);
  if (imageFiles.length > 0 && urls.length > 0) {
    return `${imageFiles.length} image${imageFiles.length > 1 ? "s" : ""} · ${urls.length} lien${urls.length > 1 ? "s" : ""}`;
  }
  if (imageFiles.length > 1) return `${imageFiles.length} images à déposer`;
  if (imageFiles.length === 1) return imageFiles[0].name || "1 image à déposer";
  if (urls.length > 1) return `${urls.length} liens à déposer`;
  if (urls.length === 1) return "1 lien à déposer";
  return "Déposer ici";
}

export function hasDropPayload(dataTransfer: DataTransfer | null) {
  if (!dataTransfer) return false;
  const { urls, imageFiles } = extractDropPayload(dataTransfer);
  if (urls.length > 0 || imageFiles.length > 0) return true;
  return [...dataTransfer.types].some(
    (t) => t === "text/uri-list" || t === "text/plain" || t === "Files" || t.startsWith("image/"),
  );
}

export { isImageFile };
