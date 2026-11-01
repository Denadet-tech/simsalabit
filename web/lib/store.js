// Guardado de creaciones en Vercel Blob. Cada creación es un JSON público:
// games/<id>.json → { id, title, lang, html, created, remixOf }
import { put, head } from '@vercel/blob';

const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';

export function newId() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, b => ALPHABET[b % ALPHABET.length]).join('');
}

export function validId(id) {
  return typeof id === 'string' && /^[a-z0-9]{6,16}$/.test(id);
}

export async function saveGame(game) {
  await put(`games/${game.id}.json`, JSON.stringify(game), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

export async function loadGame(id) {
  if (!validId(id)) return null;
  try {
    const meta = await head(`games/${id}.json`);
    const res = await fetch(meta.url, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
