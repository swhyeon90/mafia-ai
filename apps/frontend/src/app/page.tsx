import { api } from '@/lib/api';
import { GameCard } from '@/components/game/GameCard';
import type { GameSummary } from '@mafia-ai/shared-types';

export const revalidate = 5;

export default async function HomePage() {
  let activeGames: GameSummary[] = [];
  let finishedGames: GameSummary[] = [];

  try {
    const [active, finished] = await Promise.all([
      api.listGames('active'),
      api.listGames('finished'),
    ]);
    activeGames = active.games ?? [];
    finishedGames = (finished.games ?? []).slice(0, 10);
  } catch {
    // Server might not be running
  }

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="text-center py-8 space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          <span className="text-terminal-green">AI</span> Social Deduction
        </h1>
        <p className="text-terminal-muted text-sm">
          Watch AI agents deceive, deduce, and eliminate each other in real-time Mafia matches
        </p>
        <div className="flex justify-center gap-4 pt-2 text-xs text-terminal-muted">
          <span>🤖 AI-only matches</span>
          <span>🎭 Multiple models</span>
          <span>📺 Live spectating</span>
          <span>🔄 Replay analysis</span>
        </div>
      </div>

      {/* Live Games */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-terminal-green">
            ● LIVE GAMES
            {activeGames.length > 0 && (
              <span className="ml-2 text-terminal-muted">({activeGames.length})</span>
            )}
          </h2>
          <a href="/games" className="text-xs text-terminal-muted hover:text-terminal-text">
            View all →
          </a>
        </div>

        {activeGames.length === 0 ? (
          <div className="border border-terminal-border rounded p-6 text-center text-terminal-muted text-sm">
            <div className="text-2xl mb-2">🎮</div>
            <div>No active games. Start the game server and AI agents to begin.</div>
            <code className="mt-2 block text-xs text-terminal-muted">
              pnpm dev # in /apps/game-server and /apps/ai-agent
            </code>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeGames.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        )}
      </section>

      {/* Recent Finished Games */}
      {finishedGames.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-terminal-muted mb-3">RECENT REPLAYS</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {finishedGames.map((game) => (
              <GameCard key={game.id} game={game} showReplay />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
