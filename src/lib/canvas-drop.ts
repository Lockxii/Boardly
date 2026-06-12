import { extractUrlsFromText, extractUrlsFromClipboard } from "@/lib/clipboard-utils";

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

  const imageFiles: File[] = [];
  if (dataTransfer.files?.length) {
    for (const file of dataTransfer.files) {
      if (file.type.startsWith("image/")) imageFiles.push(file);
    }
  }

  return { urls: [...urls], imageFiles };
}

export function hasDropPayload(dataTransfer: DataTransfer | null) {
  if (!dataTransfer) return false;
  const { urls, imageFiles } = extractDropPayload(dataTransfer);
  if (urls.length > 0 || imageFiles.length > 0) return true;
  return [...dataTransfer.types].some(
    (t) => t === "text/uri-list" || t === "text/plain" || t.startsWith("image/"),
  );
}
