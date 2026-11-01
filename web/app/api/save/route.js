// Guarda una creación y devuelve su enlace público.
import { newId, saveGame, validId } from '../../../lib/store.js';

const MAX_HTML = 300_000;

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }); }

  const html = String(body.html || '');
  if (!/<html/i.test(html) || html.length > MAX_HTML) {
    return Response.json({ error: 'Creación no válida' }, { status: 400 });
  }
  const title = String(body.title || 'Simsalabit').slice(0, 80);
  const lang = body.lang === 'de' ? 'de' : 'es';
  const remixOf = validId(body.remixOf) ? body.remixOf : null;

  const id = newId();
  await saveGame({ id, title, lang, html, remixOf, created: new Date().toISOString() });

  const origin = new URL(req.url).origin;
  return Response.json({ id, url: `${origin}/j/${id}` });
}
