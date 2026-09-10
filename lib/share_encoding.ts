// Encode un chantier dans une URL publique partageable. Pas de backend requis :
// toutes les données du chantier tiennent dans le paramètre URL en base64url.
//
// Un chantier compact (~5 postes, sans thumbnail) fait ~400 chars encoded → URL sûre partout.
// Avec thumbnail 512px JPEG q0.6 (~25 KB), l'URL grimpe à ~35 KB : au-delà des limites
// pratiques de WhatsApp/SMS mais toujours OK pour un browser desktop. On propose donc
// deux modes : "compact" (sans photo) pour partage, "riche" (avec photo) pour bookmark local.
//
// Format : base64url(JSON.stringify(payload)). Version dans le payload pour migration future.

import type { Chantier } from "./types";

const SHARE_VERSION = 1;

export type SharePayload = {
  v: number;                  // version schema
  c: Chantier;                // chantier complet
  photo?: string;             // thumbnail data URL (optionnel — gonfle beaucoup)
  meta?: {
    createdBy?: string;       // Anthony / Harold / Jade — futur mode marketplace
    generatedAt?: string;     // ISO date de génération du lien
  };
};

// base64url : base64 URL-safe (remplace +/= par -_.)
function toBase64Url(s: string): string {
  return btoa(unescape(encodeURIComponent(s)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(s: string): string {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  return decodeURIComponent(escape(atob(padded)));
}

export function encodeChantier(chantier: Chantier, photo?: string): string {
  const payload: SharePayload = {
    v: SHARE_VERSION,
    c: chantier,
    ...(photo ? { photo } : {}),
    meta: { generatedAt: new Date().toISOString() },
  };
  return toBase64Url(JSON.stringify(payload));
}

export function decodeChantier(encoded: string): SharePayload | null {
  try {
    const raw = fromBase64Url(encoded);
    const p = JSON.parse(raw) as SharePayload;
    if (typeof p !== "object" || p === null || !p.c || !p.c.id) return null;
    return p;
  } catch {
    return null;
  }
}

// URL absolue partageable — utilise l'origine du browser (dev = localhost, prod = domaine).
export function buildShareUrl(chantier: Chantier, photo?: string): string {
  const encoded = encodeChantier(chantier, photo);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/share/${encoded}`;
}

// WhatsApp share : message + lien. Le texte est court car le lien lui-même contient tout.
export function buildShareMessage(chantier: Chantier, url: string, totalMid: number): string {
  const nPosts = chantier.posts.length;
  return [
    `📋 *${chantier.name}*`,
    `${nPosts} serviço${nPosts > 1 ? "s" : ""} · R$ ${Math.round(totalMid).toLocaleString("pt-BR")}`,
    ``,
    `Ver detalhes : ${url}`,
    ``,
    `_Feito com Custa Quanto — estimador de reforma RJ_`,
  ].join("\n");
}
