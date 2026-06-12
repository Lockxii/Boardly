import { compressImageFile } from "@/lib/canvas-utils";

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|svg|bmp|avif|heic|heif)$/i;

export function isImageFile(file: File) {
  if (file.type.startsWith("image/")) return true;
  return IMAGE_EXT.test(file.name);
}

export function getImageDisplaySize(naturalWidth: number, naturalHeight: number, max = 420) {
  const safeW = Math.max(naturalWidth, 1);
  const safeH = Math.max(naturalHeight, 1);
  const scale = Math.min(1, max / Math.max(safeW, safeH));
  return {
    width: Math.max(64, Math.round(safeW * scale)),
    height: Math.max(64, Math.round(safeH * scale)),
  };
}

export async function getDataUrlDimensions(src: string) {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
  return { width: img.naturalWidth, height: img.naturalHeight };
}

export async function prepareImageFromFile(file: File) {
  const src = await compressImageFile(file);
  const { width: naturalWidth, height: naturalHeight } = await getDataUrlDimensions(src);
  const { width, height } = getImageDisplaySize(naturalWidth, naturalHeight);
  return { src, width, height, name: file.name };
}

export type ImagePasteItem = {
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export function layoutImagePasteGrid(
  sizes: { width: number; height: number }[],
  centerX: number,
  centerY: number,
  gap = 16,
): { x: number; y: number }[] {
  if (sizes.length === 0) return [];
  const cols =
    sizes.length <= 1 ? 1 : sizes.length <= 4 ? 2 : Math.min(4, Math.ceil(Math.sqrt(sizes.length)));
  const rowCount = Math.ceil(sizes.length / cols);
  const rowHeights: number[] = [];
  const rowWidths: number[] = [];

  for (let r = 0; r < rowCount; r++) {
    const start = r * cols;
    const end = Math.min(start + cols, sizes.length);
    const rowSizes = sizes.slice(start, end);
    rowHeights.push(Math.max(...rowSizes.map((s) => s.height)));
    rowWidths.push(rowSizes.reduce((sum, s, i) => sum + s.width + (i > 0 ? gap : 0), 0));
  }

  const totalHeight = rowHeights.reduce((sum, h, i) => sum + h + (i > 0 ? gap : 0), 0);
  let y = centerY - totalHeight / 2;
  const positions: { x: number; y: number }[] = [];

  for (let r = 0; r < rowCount; r++) {
    const start = r * cols;
    const end = Math.min(start + cols, sizes.length);
    let x = centerX - rowWidths[r] / 2;

    for (let i = start; i < end; i++) {
      positions.push({ x, y });
      x += sizes[i].width + gap;
    }

    y += rowHeights[r] + gap;
  }

  return positions;
}

export function collectImageFilesFromDataTransfer(dataTransfer: DataTransfer | null): File[] {
  if (!dataTransfer) return [];

  const seen = new Set<string>();
  const files: File[] = [];

  const add = (file: File | null) => {
    if (!file || !isImageFile(file)) return;
    const key = `${file.name}-${file.size}-${file.lastModified}`;
    if (seen.has(key)) return;
    seen.add(key);
    files.push(file);
  };

  if (dataTransfer.items?.length) {
    for (const item of dataTransfer.items) {
      if (item.kind === "file") add(item.getAsFile());
    }
  }

  if (dataTransfer.files?.length) {
    for (const file of dataTransfer.files) add(file);
  }

  return files;
}

export function filePreviewKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}
