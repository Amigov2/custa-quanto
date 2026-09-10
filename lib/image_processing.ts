// Helpers de traitement d image côté client — utilisés par /foto (analyse) et la home
// (input hybride). Extrait de app/foto/page.tsx pour éviter la duplication.

// Resize à 2000px + JPEG q0.85. Une photo iPhone de 12 MB tombe à ~500 KB
// sans perte visible pour l analyse Vision, et évite la limite backend 8 MB.
export async function compressImage(file: File, maxDim = 2000, quality = 0.85): Promise<File> {
  if (file.size <= 1_500_000 && file.type !== "image/heic" && file.type !== "image/heif") return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, "image/jpeg", quality));
  if (!blob) return file;
  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg" });
}

// Vignette 512px JPEG q0.75 → ~30-60 KB en base64 dans localStorage.
export async function makeThumbnail(file: File, maxDim = 512, quality = 0.75): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas ctx null");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", quality);
}

// Placeholder gris utilisé si la génération de vignette échoue.
export const PLACEHOLDER_THUMB =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#e5e5e7"/><path d="M12 15h4l1.5-2h5L24 15h4v10H12V15z" fill="none" stroke="#86868b" stroke-width="1.5"/><circle cx="20" cy="20" r="3" fill="none" stroke="#86868b" stroke-width="1.5"/></svg>',
  );
