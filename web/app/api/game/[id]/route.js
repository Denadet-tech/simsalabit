// Devuelve una creación (para el botón "Hazlo tuyo").
import { loadGame } from '../../../../lib/store.js';

export async function GET(_req, { params }) {
  const { id } = await params;
  const game = await loadGame(id);
  if (!game) return Response.json({ error: 'No existe' }, { status: 404 });
  return Response.json({ id: game.id, title: game.title, lang: game.lang, html: game.html });
}
