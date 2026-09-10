"use client";

/**
 * Shrink a photo in the browser before it is uploaded.
 *
 * A phone camera produces a 3-5 MB, 4000-pixel JPEG. The product grid shows it
 * at a couple of hundred pixels, over shop wifi, on every terminal, every
 * morning. Nothing server-side resizes it -- Supabase's image transformation
 * is a paid add-on and the Go API never touches files -- so the only place to
 * make the file small is here, before it leaves the counter.
 *
 * The result is WebP at 80% when the browser can encode it, JPEG otherwise.
 * A file that is already small, or that is not a raster photo at all, is
 * returned untouched: re-encoding a 40 KB PNG icon or a GIF gains nothing and
 * can lose transparency or animation.
 */

/** Longest edge after resizing. Product cards never render wider than this. */
export const MAX_IMAGE_EDGE = 1280;

/** Encoder quality for the lossy output. 0.8 is visually clean for food photos. */
export const IMAGE_QUALITY = 0.8;

/** Below this size there is nothing worth saving. */
export const COMPRESS_ABOVE_BYTES = 200 * 1024;

const rasterTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

/** Pure. Whether a file of this type and size is worth compressing at all. */
export function shouldCompress(type: string, size: number): boolean {
  return rasterTypes.has(type) && size > COMPRESS_ABOVE_BYTES;
}

/** Pure. Fit width x height inside MAX_IMAGE_EDGE, preserving aspect ratio. */
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number = MAX_IMAGE_EDGE,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) {
    return { width, height };
  }
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function replaceExtension(name: string, extension: string): string {
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  return `${stem}.${extension}`;
}

function encode(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, IMAGE_QUALITY));
}

/**
 * Returns the compressed file, or the original when compression does not
 * apply or would not help. Never throws for a decodable image; a file the
 * browser cannot decode is passed through unchanged so the upload can still
 * fail with the real error rather than a resizing one.
 */
export async function compressImage(file: File): Promise<File> {
  if (!shouldCompress(file.type, file.size) || typeof createImageBitmap !== "function") {
    return file;
  }

  let bitmap: ImageBitmap;
  try {
    // from-image honours the EXIF orientation, so a portrait phone photo does
    // not come out sideways once the metadata is stripped by re-encoding.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }

  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      return file;
    }
    context.drawImage(bitmap, 0, 0, width, height);

    // WebP first; a browser without a WebP encoder answers with a PNG blob
    // (type mismatch) or null, and JPEG takes over.
    let blob = await encode(canvas, "image/webp");
    let extension = "webp";
    if (blob?.type !== "image/webp") {
      blob = await encode(canvas, "image/jpeg");
      extension = "jpg";
    }
    if (!blob || blob.size >= file.size) {
      return file;
    }

    return new File([blob], replaceExtension(file.name, extension), {
      type: blob.type,
      lastModified: file.lastModified,
    });
  } finally {
    bitmap.close();
  }
}
