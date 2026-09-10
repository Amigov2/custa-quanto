// Helpers de traitement d image côté client — utilisés par /foto (analyse) et la home
// (input hybride). Extrait de app/foto/page.tsx pour éviter la duplication.

// Resize à 2000px + JPEG q0.85. Une photo iPhone de 12 MB tombe à ~500 KB
// sans perte visible pour l analyse Vision, et évite la limite backend 8 MB.
//
// Robustesse iOS : HEIC/HEIF anciens peuvent faire échouer createImageBitmap.
// On tente un fallback via <img> + canvas si le premier chemin plante.
export async function compressImage(file: File, maxDim = 2000, quality = 0.85): Promise<File> {
  // Fichier déjà petit ET pas HEIC → on renvoie tel quel.
  if (file.size <= 1_500_000 && file.type !== "image/heic" && file.type !== "image/heif") return file;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;

  // Chemin principal : createImageBitmap (rapide, moderne).
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
  } catch {
    // Fallback : <img> + FileReader (fonctionne sur HEIC ancien via Safari iOS).
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("FileReader failed"));
      reader.readAsDataURL(file);
    });
    const img: HTMLImageElement = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Image decode failed"));
      el.src = dataUrl;
    });
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }

  const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, "image/jpeg", quality));
  if (!blob) throw new Error("Canvas toBlob failed");
  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg" });
}

// Vignette 512px JPEG q0.75 → ~30-60 KB en base64 dans localStorage.
// Même robustesse iOS que compressImage : fallback FileReader+Image si createImageBitmap échoue.
export async function makeThumbnail(file: File, maxDim = 512, quality = 0.75): Promise<string> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas ctx null");

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
  } catch {
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("FileReader failed"));
      reader.readAsDataURL(file);
    });
    const img: HTMLImageElement = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Image decode failed"));
      el.src = dataUrl;
    });
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }

  return canvas.toDataURL("image/jpeg", quality);
}

// Placeholder gris utilisé si la génération de vignette échoue.
export const PLACEHOLDER_THUMB =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#e5e5e7"/><path d="M12 15h4l1.5-2h5L24 15h4v10H12V15z" fill="none" stroke="#86868b" stroke-width="1.5"/><circle cx="20" cy="20" r="3" fill="none" stroke="#86868b" stroke-width="1.5"/></svg>',
  );
