// Historique des analyses photo. Chaque record = 1 photo + son analyse + son scope.
// Rattaché à un chantier via chantierId (null = brouillon).
// Stockage localStorage. Vignettes 512px WebP q0.7 ~30 KB → ~150 photos possibles avant saturation.

import type { PhotoAnalysis } from "./vision";

const KEY = "cq_photos";

export type PhotoRecord = {
  id: string;
  chantierId: string | null;   // null tant que non rattaché
  dateISO: string;              // création (upload)
  thumbnail: string;            // data:image/webp;base64,... (~30 KB)
  analysis: PhotoAnalysis;
  userScope: string;            // texte libre saisi par l'user
  label?: string;               // ex: "Antes", "Após demolição", "Cerâmica posta"
};

export function loadPhotos(): PhotoRecord[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function savePhoto(rec: Omit<PhotoRecord, "id" | "dateISO">): PhotoRecord {
  const list = loadPhotos();
  const record: PhotoRecord = {
    ...rec,
    id: "ph_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
    dateISO: new Date().toISOString(),
  };
  list.push(record);
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent("cq-photos-change"));
  return record;
}

export function updatePhoto(id: string, patch: Partial<Omit<PhotoRecord, "id" | "dateISO">>): void {
  const list = loadPhotos();
  const idx = list.findIndex(p => p.id === id);
  if (idx < 0) return;
  list[idx] = { ...list[idx], ...patch };
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent("cq-photos-change"));
}

export function deletePhoto(id: string): void {
  const list = loadPhotos().filter(p => p.id !== id);
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent("cq-photos-change"));
}

export function attachToChantier(photoId: string, chantierId: string): void {
  updatePhoto(photoId, { chantierId });
}

export function getPhotosByChantier(chantierId: string): PhotoRecord[] {
  return loadPhotos()
    .filter(p => p.chantierId === chantierId)
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO));
}

export function getDrafts(): PhotoRecord[] {
  return loadPhotos()
    .filter(p => p.chantierId === null)
    .sort((a, b) => b.dateISO.localeCompare(a.dateISO));
}

export function getPhoto(id: string): PhotoRecord | undefined {
  return loadPhotos().find(p => p.id === id);
}

export function onPhotosChange(cb: () => void): () => void {
  const handler = () => cb();
  window.addEventListener("cq-photos-change", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("cq-photos-change", handler);
    window.removeEventListener("storage", handler);
  };
}
