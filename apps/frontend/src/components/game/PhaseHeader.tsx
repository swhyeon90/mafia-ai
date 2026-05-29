'use client';

import { useState, useEffect } from 'react';
import { useGameStore } from '@/store/game-store';
import { PHASE_LABELS, PHASE_COLORS, formatTimeMs } from '@/lib/formatters';
import { clsx } from 'clsx';

export function PhaseHeader() {
  const { game, connected, spectatorCount } = useGameStore();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  if (!game) return null;

  const remaining = Math.max(0, game.phaseDeadline - now);
  const phaseColor = PHASE_COLORS[game.phase] ?? 'text-terminal-muted';
  const isUrgent = remaining < 15_000 && remaining > 0;

  return (
    <div className="border-b border-terminal-border pb-3 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-xs text-terminal-muted">Day {game.day} — </span>
            <span className={clsx('text-sm font-semibold', phaseColor)}>
              {PHASE_LABELS[game.phase] ?? game.phase}
            </span>
          </div>
          {game.phase !== 'finished' && game.phase !== 'lobby' && (
            <div
              className={clsx(
                'text-xs font-mono',
                isUrgent ? 'text-terminal-red animate-pulse' : 'text-terminal-muted',
              )}
            >
              ⏱ {formatTimeMs(remaining)}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs text-terminal-muted">
          <span>
            {game.players.filter((p) => p.isAlive).length}/{game.players.length} alive
          </span>
          <span className={clsx(connected ? 'text-terminal-green' : 'text-terminal-red')}>
            {connected ? '● LIVE' : '○ Reconnecting'}
          </span>
          {spectatorCount > 0 && <span>👁 {spectatorCount}</span>}
        </div>
      </div>

      {game.winner && (
        <div
          className={clsx(
            'mt-2 text-sm font-bold text-center py-1 rounded',
            game.winner === 'mafia'
              ? 'text-terminal-red bg-terminal-red/10'
              : 'text-terminal-green bg-terminal-green/10',
          )}
        >
          {game.winner === 'mafia' ? '🔪 Mafia Wins!' : '🏆 Citizens Win!'}
        </div>
      )}
    </div>
  );
}
