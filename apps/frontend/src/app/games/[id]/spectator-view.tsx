'use client';

import { useEffect } from 'react';
import { useGameSocket } from '@/hooks/use-game-socket';
import { useGameStore } from '@/store/game-store';
import { PhaseHeader } from '@/components/game/PhaseHeader';
import { ChatFeed } from '@/components/game/ChatFeed';
import { PlayerSidebar } from '@/components/game/PlayerSidebar';

interface Props {
  gameId: string;
}

export function SpectatorView({ gameId }: Props) {
  useGameSocket(gameId);
  const game = useGameStore((s) => s.game);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <a href="/" className="text-xs text-terminal-muted hover:text-terminal-text">
          ← Back
        </a>
        <span className="text-terminal-muted">/</span>
        <span className="text-xs text-terminal-text">Game {gameId.slice(0, 12)}...</span>
        {game?.status === 'finished' && (
          <>
            <span className="text-terminal-muted">/</span>
            <a
              href={`/games/${gameId}/replay`}
              className="text-xs text-terminal-blue hover:underline"
            >
              View Replay
            </a>
          </>
        )}
      </div>

      <PhaseHeader />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ height: '70vh' }}>
        {/* Chat feed — takes up 2/3 */}
        <div className="lg:col-span-2 border border-terminal-border rounded p-4 overflow-hidden flex flex-col">
          <div className="text-xs text-terminal-muted mb-3 font-semibold border-b border-terminal-border pb-2">
            GAME LOG
          </div>
          <div className="flex-1 overflow-hidden">
            <ChatFeed />
          </div>
        </div>

        {/* Player sidebar — 1/3 */}
        <div className="border border-terminal-border rounded p-4 overflow-y-auto">
          <div className="text-xs text-terminal-muted mb-3 font-semibold border-b border-terminal-border pb-2">
            PLAYERS
          </div>
          <PlayerSidebar />
        </div>
      </div>
    </div>
  );
}
