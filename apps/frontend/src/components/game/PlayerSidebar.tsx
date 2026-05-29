'use client';

import { useGameStore } from '@/store/game-store';
import { ROLE_COLORS, ROLE_EMOJIS } from '@/lib/formatters';
import { clsx } from 'clsx';
import type { Role } from '@mafia-ai/shared-types';

export function PlayerSidebar() {
  const game = useGameStore((s) => s.game);

  if (!game) return null;

  const alivePlayers = game.players.filter((p) => p.isAlive);
  const deadPlayers = game.players.filter((p) => !p.isAlive);

  return (
    <div className="space-y-4">
      {/* Vote tally */}
      {game.phase === 'voting' && Object.keys(game.voteTally ?? {}).length > 0 && (
        <div>
          <div className="text-xs text-terminal-yellow mb-2 font-semibold">VOTE TALLY</div>
          <div className="space-y-1">
            {Object.entries(game.voteTally)
              .sort(([, a], [, b]) => b - a)
              .map(([targetId, count]) => {
                const target = game.players.find((p) => p.id === targetId);
                const total = alivePlayers.length;
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={targetId} className="space-y-0.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-terminal-text truncate">{target?.agentName ?? targetId.slice(0, 8)}</span>
                      <span className="text-terminal-yellow">{count}</span>
                    </div>
                    <div className="h-1 bg-terminal-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-terminal-yellow transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Alive players */}
      <div>
        <div className="text-xs text-terminal-green mb-2 font-semibold">
          ALIVE ({alivePlayers.length})
        </div>
        <div className="space-y-1">
          {alivePlayers.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2 p-1.5 rounded hover:bg-terminal-border/30 transition-colors"
            >
              <div className="w-6 h-6 rounded bg-terminal-border flex items-center justify-center text-xs font-bold">
                {p.agentName.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{p.agentName}</div>
                <div className="text-xs text-terminal-muted truncate">
                  {p.model.split('-').slice(-2).join('-')} · {p.personality}
                </div>
              </div>
              {p.role && (
                <div className={clsx('text-xs', ROLE_COLORS[p.role as Role])}>
                  {ROLE_EMOJIS[p.role as Role]}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Dead players */}
      {deadPlayers.length > 0 && (
        <div>
          <div className="text-xs text-terminal-red mb-2 font-semibold">
            ELIMINATED ({deadPlayers.length})
          </div>
          <div className="space-y-1">
            {deadPlayers.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 p-1.5 opacity-50"
              >
                <div className="w-6 h-6 rounded bg-terminal-border flex items-center justify-center text-xs">
                  ✕
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs line-through text-terminal-muted truncate">
                    {p.agentName}
                  </div>
                  {p.role && (
                    <div className={clsx('text-xs', ROLE_COLORS[p.role as Role])}>
                      {ROLE_EMOJIS[p.role as Role]} {p.role}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
