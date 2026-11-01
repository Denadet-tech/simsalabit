// Página pública para jugar una creación: simsalabit.../j/<id>
import { notFound } from 'next/navigation';
import { loadGame } from '../../../lib/store.js';
import Logo from '../../logo.js';

export const dynamic = 'force-dynamic';

const TXT = {
  es: { remix: '🪄 Hazlo tuyo', make: '✨ Crea el tuyo', made: 'Creado con Simsalabit', play: 'Juega en Simsalabit' },
  de: { remix: '🪄 Mach es zu deinem', make: '✨ Erschaffe deins', made: 'Erschaffen mit Simsalabit', play: 'Spiel auf Simsalabit' },
};

export async function generateMetadata({ params }) {
  const { id } = await params;
  const game = await loadGame(id);
  if (!game) return { title: 'Simsalabit' };
  const t = TXT[game.lang] || TXT.es;
  return {
    title: `${game.title} – ${t.play}`,
    description: t.made,
    openGraph: { title: `🎮 ${game.title}`, description: t.play },
  };
}

export default async function PlayPage({ params }) {
  const { id } = await params;
  const game = await loadGame(id);
  if (!game) notFound();
  const t = TXT[game.lang] || TXT.es;

  return (
    <main className="play">
      <div className="playbar">
        <a href="/" className="brand" aria-label="Simsalabit"><Logo size={30} /></a>
        <div className="playtitle">{game.title}</div>
        <a className="pill green" href={`/?remix=${game.id}`}>{t.remix}</a>
      </div>
      <iframe
        className="playframe"
        title={game.title}
        srcDoc={game.html}
        sandbox="allow-scripts"
      />
      <a className="madewith" href="/">{t.make}</a>
    </main>
  );
}
