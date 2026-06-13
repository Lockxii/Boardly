import { prisma } from "./prisma.js";

export type VisionAssetInput = {
  label: string;
  mimeType?: string;
  data?: string;
  src?: string;
};

export type ResolvedVisionAsset = {
  label: string;
  mimeType: string;
  data: string;
};

const MAX_IMAGES = 20;
const MAX_BYTES = 450_000;
const FETCH_TIMEOUT_MS = 8_000;

const ALLOWED_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function parseDataUrl(dataUrl: string): ResolvedVisionAsset | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const mimeType = match[1].toLowerCase();
  const data = match[2];
  if (!ALLOWED_MIMES.has(mimeType)) return null;
  const bytes = Buffer.byteLength(data, "base64");
  if (bytes > MAX_BYTES) return null;
  return { label: "image", mimeType, data };
}

async function readFileAttachment(fileId: string): Promise<ResolvedVisionAsset | null> {
  const attachment = await prisma.chatAttachment.findUnique({ where: { id: fileId } });
  if (!attachment) return null;

  const base64 = attachment.data;
  const matches = base64.match(/^data:([^;]+);base64,(.+)$/);
  if (matches) {
    const mimeType = matches[1].toLowerCase();
    if (!ALLOWED_MIMES.has(mimeType)) return null;
    const data = matches[2];
    if (Buffer.byteLength(data, "base64") > MAX_BYTES) return null;
    return { label: attachment.name || "Fichier", mimeType, data };
  }

  const data = base64.includes(",") ? base64.split(",")[1] : base64;
  const mimeType = attachment.type?.toLowerCase() || "image/jpeg";
  if (!ALLOWED_MIMES.has(mimeType)) return null;
  if (Buffer.byteLength(data, "base64") > MAX_BYTES) return null;
  return { label: attachment.name || "Fichier", mimeType, data };
}

async function fetchRemoteImage(src: string): Promise<ResolvedVisionAsset | null> {
  if (!/^https?:\/\//i.test(src)) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(src, {
      signal: controller.signal,
      headers: { "User-Agent": "Boardly-Fred/1.0", Accept: "image/*" },
      redirect: "follow",
    });
    if (!res.ok) return null;

    const contentType = (res.headers.get("content-type") || "image/jpeg").split(";")[0].toLowerCase();
    if (!ALLOWED_MIMES.has(contentType)) return null;

    const length = Number(res.headers.get("content-length") || 0);
    if (length > MAX_BYTES) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength > MAX_BYTES) return null;

    return {
      label: "Image distante",
      mimeType: contentType,
      data: buffer.toString("base64"),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function resolveSingleAsset(input: VisionAssetInput): Promise<ResolvedVisionAsset | null> {
  if (input.data && input.mimeType) {
    const mimeType = input.mimeType.toLowerCase();
    if (!ALLOWED_MIMES.has(mimeType)) return null;
    if (Buffer.byteLength(input.data, "base64") > MAX_BYTES) return null;
    return { label: input.label, mimeType, data: input.data };
  }

  if (!input.src) return null;

  if (input.src.startsWith("data:")) {
    const parsed = parseDataUrl(input.src);
    return parsed ? { ...parsed, label: input.label } : null;
  }

  const fileMatch = input.src.match(/\/api\/file\/([^/?#]+)/);
  if (fileMatch) {
    const file = await readFileAttachment(fileMatch[1]);
    return file ? { ...file, label: input.label } : null;
  }

  if (/^https?:\/\//i.test(input.src)) {
    const remote = await fetchRemoteImage(input.src);
    return remote ? { ...remote, label: input.label } : null;
  }

  return null;
}

export async function resolveVisionAssets(inputs: VisionAssetInput[] | undefined) {
  if (!inputs?.length) return { assets: [] as ResolvedVisionAsset[], skipped: 0 };

  const assets: ResolvedVisionAsset[] = [];
  let skipped = 0;

  for (const input of inputs.slice(0, MAX_IMAGES)) {
    const resolved = await resolveSingleAsset(input);
    if (resolved) assets.push(resolved);
    else skipped += 1;
  }

  if (inputs.length > MAX_IMAGES) {
    skipped += inputs.length - MAX_IMAGES;
  }

  return { assets, skipped };
}
