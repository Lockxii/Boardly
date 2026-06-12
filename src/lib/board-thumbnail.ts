import type { Layer } from "@/lib/types";

function getPathD(points: number[][]) {
  if (!points?.length) return "";
  let d = "";
  let move = true;
  for (const point of points) {
    if (point[3] === 1) {
      move = true;
      continue;
    }
    d += move ? `M ${point[0]} ${point[1]}` : ` L ${point[0]} ${point[1]}`;
    move = false;
  }
  return d;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function layerToSvg(_id: string, layer: Layer) {
  const fill = layer.fill || "#e5e7eb";
  const stroke = layer.stroke || "transparent";
  const strokeWidth = layer.strokeWidth || 0;
  const transform = `translate(${layer.x} ${layer.y})`;

  switch (layer.type) {
    case "Rectangle":
      return `<g transform="${transform}"><rect width="${layer.width}" height="${layer.height}" rx="${layer.cornerRadius || 0}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" /></g>`;
    case "Ellipse":
      return `<g transform="${transform}"><ellipse cx="${layer.width / 2}" cy="${layer.height / 2}" rx="${layer.width / 2}" ry="${layer.height / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" /></g>`;
    case "Triangle":
      return `<g transform="${transform}"><polygon points="0,${layer.height} ${layer.width / 2},0 ${layer.width},${layer.height}" fill="${fill}" /></g>`;
    case "Diamond":
      return `<g transform="${transform}"><polygon points="${layer.width / 2},0 ${layer.width},${layer.height / 2} ${layer.width / 2},${layer.height} 0,${layer.height / 2}" fill="${fill}" /></g>`;
    case "Star":
      return `<g transform="${transform}"><polygon points="${layer.width * 0.5},0 ${layer.width * 0.63},${layer.height * 0.38} ${layer.width},${layer.height * 0.38} ${layer.width * 0.69},${layer.height * 0.59} ${layer.width * 0.82},${layer.height} ${layer.width * 0.5},${layer.height * 0.75} ${layer.width * 0.18},${layer.height} ${layer.width * 0.31},${layer.height * 0.59} 0,${layer.height * 0.38} ${layer.width * 0.37},${layer.height * 0.38}" fill="${fill}" /></g>`;
    case "Arrow":
      return `<g transform="${transform}"><path d="M 0,${layer.height * 0.3} L ${layer.width * 0.6},${layer.height * 0.3} L ${layer.width * 0.6},0 L ${layer.width},${layer.height * 0.5} L ${layer.width * 0.6},${layer.height} L ${layer.width * 0.6},${layer.height * 0.7} L 0,${layer.height * 0.7} Z" fill="${fill}" /></g>`;
    case "Path": {
      const d = getPathD(layer.points || []);
      if (!d) return "";
      return `<g transform="${transform}"><path d="${d}" fill="none" stroke="${fill}" stroke-width="${layer.strokeWidth || 2}" stroke-linecap="round" stroke-linejoin="round" /></g>`;
    }
    case "Note":
      return `<g transform="${transform}"><rect width="${layer.width}" height="${layer.height}" rx="8" fill="${fill || "#fef3c7"}" /><text x="10" y="22" font-size="12" fill="#374151">${escapeXml((layer.value || "").replace(/<[^>]+>/g, "").slice(0, 40))}</text></g>`;
    case "Text":
      return `<g transform="${transform}"><text x="0" y="18" font-size="${layer.fontSize || 16}" font-weight="bold" fill="${layer.textColor || layer.fill || "#111"}">${escapeXml((layer.value || "").replace(/<[^>]+>/g, "").slice(0, 48))}</text></g>`;
    case "Image":
      return layer.src
        ? `<g transform="${transform}"><image href="${layer.src}" width="${layer.width}" height="${layer.height}" preserveAspectRatio="xMidYMid slice" /></g>`
        : `<g transform="${transform}"><rect width="${layer.width}" height="${layer.height}" fill="#dbeafe" /></g>`;
    default:
      return `<g transform="${transform}"><rect width="${layer.width}" height="${layer.height}" fill="${fill}" /></g>`;
  }
}

export function generateBoardThumbnail(
  layers: Record<string, Layer>,
  layerIds: string[],
  width = 320,
  height = 200
): Promise<string | null> {
  if (typeof window === "undefined" || layerIds.length === 0) return Promise.resolve(null);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const id of layerIds) {
    const layer = layers[id];
    if (!layer) continue;
    minX = Math.min(minX, layer.x);
    minY = Math.min(minY, layer.y);
    maxX = Math.max(maxX, layer.x + layer.width);
    maxY = Math.max(maxY, layer.y + layer.height);
  }

  if (!Number.isFinite(minX)) return Promise.resolve(null);

  const contentW = Math.max(maxX - minX, 1);
  const contentH = Math.max(maxY - minY, 1);
  const padding = 16;
  const scale = Math.min((width - padding * 2) / contentW, (height - padding * 2) / contentH);
  const offsetX = padding - minX * scale + (width - padding * 2 - contentW * scale) / 2;
  const offsetY = padding - minY * scale + (height - padding * 2 - contentH * scale) / 2;

  const shapes = layerIds.map((id) => layerToSvg(id, layers[id]!)).filter(Boolean).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#fafafa"/><g transform="translate(${offsetX} ${offsetY}) scale(${scale})">${shapes}</g></svg>`;

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(null);
      ctx.fillStyle = "#fafafa";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = () => resolve(null);
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}
