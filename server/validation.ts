import { z } from "zod";

/** Thrown when a request body/params fail validation; mapped to HTTP 400. */
export class ValidationError extends Error {
  status = 400 as const;
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/** Parse `data` with `schema`, throwing a ValidationError (→ 400) on failure. */
export function parseOrThrow<S extends z.ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const msg = result.error.issues
      .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
      .join("; ");
    throw new ValidationError(msg);
  }
  return result.data;
}

/** Allowed MIME types for uploads (chat images + voice notes). */
export const ALLOWED_UPLOAD_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
]);

/** Max decoded upload size (bytes). Chat images should be small. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB

/** Max serialized canvasData size persisted per board. */
export const MAX_CANVAS_BYTES = 12 * 1024 * 1024; // 12 MB

export const boardCreateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  template: z.string().trim().max(64).optional(),
});

export const boardTitleSchema = z.object({
  title: z.string().trim().min(1).max(200),
});

export const boardPatchSchema = z.object({
  folder: z.string().max(120).nullable().optional(),
  tags: z.array(z.string().max(60)).max(50).optional(),
  isPublic: z.boolean().optional(),
});

export const joinSchema = z.object({
  inviteToken: z.string().min(1).max(128).optional(),
});

export const uploadSchema = z.object({
  name: z.string().max(255).default("file"),
  type: z.string().max(120).default(""),
  size: z.number().int().nonnegative().max(MAX_UPLOAD_BYTES).optional(),
  data: z.string().min(1),
});

/**
 * Lenient-but-bounded canvas payload schema. Unknown keys pass through (the
 * client store owns the full shape) but the top-level must be an object and the
 * serialized size is capped to protect the database.
 */
export const boardContentSchema = z.object({
  canvasData: z
    .object({})
    .passthrough()
    .refine(
      (v) => JSON.stringify(v).length <= MAX_CANVAS_BYTES,
      `canvasData dépasse la taille maximale (${Math.round(MAX_CANVAS_BYTES / 1024 / 1024)} Mo)`,
    ),
  thumbnail: z.string().max(2_000_000).optional(),
  baseRev: z.number().int().nonnegative().optional(),
});
