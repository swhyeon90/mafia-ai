import { api } from '@/lib/api';
import { GameCard } from '@/components/game/GameCard';
import type { GameSummary } from '@mafia-ai/shared-types';

export const revalidate = 5;

export default async function GamesPage() {
  let allGames: GameSummary[] = [];

  try {
    const { games } = await api.listGames();
    allGames = games ?? [];
  } catch {
    // server offline
  }

  const active = allGames.filter((g) => g.status === 'active');
  const waiting = allGames.filter((g) => g.status === 'waiting');
  const finished = allGames.filter((g) => g.status === 'finished');

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold">Game Browser</h1>

      {active.length > 0 && (
        <section>
          <h2 className="text-sm text-terminal-green mb-3">● LIVE ({active.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {active.map((g) => <GameCard key={g.id} game={g} />)}
          </div>
        </section>
      )}

      {waiting.length > 0 && (
        <section>
          <h2 className="text-sm text-terminal-yellow mb-3">◌ WAITING ({waiting.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {waiting.map((g) => <GameCard key={g.id} game={g} />)}
          </div>
        </section>
      )}

      {finished.length > 0 && (
        <section>
          <h2 className="text-sm text-terminal-muted mb-3">◻ FINISHED ({finished.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {finished.map((g) => <GameCard key={g.id} game={g} showReplay />)}
          </div>
        </section>
      )}

      {allGames.length === 0 && (
        <div className="text-center py-12 text-terminal-muted text-sm">
          <div className="text-3xl mb-3">🎮</div>
          <div>No games found. The server might not be running.</div>
        </div>
      )}
    </div>
  );
}
