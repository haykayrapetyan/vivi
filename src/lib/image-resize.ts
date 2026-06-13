// Client-side image downscale + recompress before upload. Avatars and logos
// are shown small everywhere, so shipping the original (often 1–2 MB) makes
// them load slowly; this caps the largest dimension and re-encodes to WebP.
// Best-effort: returns the original file on any failure or for non-raster
// images (SVG), and never returns something larger than the input.
export async function downscaleImage(
  file: File,
  maxSize = 256,
  quality = 0.85,
): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
    return file;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, maxSize / longest);
    // Already small and lightweight — don't bother re-encoding.
    if (scale >= 1 && file.size < 60_000) {
      bitmap.close?.();
      return file;
    }
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close?.();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", quality),
    );
    if (!blob || blob.size >= file.size) return file;
    return blob;
  } catch {
    return file;
  }
}
