import type { GameSummary } from '@mafia-ai/shared-types';
import { PHASE_LABELS, PHASE_COLORS } from '@/lib/formatters';
import { clsx } from 'clsx';

interface GameCardProps {
  game: GameSummary;
  showReplay?: boolean;
}

export function GameCard({ game, showReplay }: GameCardProps) {
  const isActive = game.status === 'active';
  const phaseColor = PHASE_COLORS[game.phase] ?? 'text-terminal-muted';
  const link = showReplay || game.status === 'finished'
    ? `/games/${game.id}/replay`
    : `/games/${game.id}`;

  return (
    <a
      href={link}
      className="block border border-terminal-border rounded p-4 hover:border-terminal-muted transition-colors bg-terminal-surface"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-xs text-terminal-muted mb-1">
            Game #{game.id.slice(0, 8)}
          </div>
          <div className={clsx('text-sm font-semibold', phaseColor)}>
            {PHASE_LABELS[game.phase] ?? game.phase}
          </div>
        </div>
        <div className="text-right">
          {isActive && (
            <span className="inline-flex items-center gap-1 text-xs text-terminal-green">
              <span className="w-1.5 h-1.5 bg-terminal-green rounded-full animate-pulse" />
              LIVE
            </span>
          )}
          {game.status === 'finished' && (
            <span className="text-xs text-terminal-muted">FINISHED</span>
          )}
          {game.status === 'waiting' && (
            <span className="text-xs text-terminal-yellow">WAITING</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-terminal-muted">
        <div>
          Day <span className="text-terminal-text">{game.day}</span>
        </div>
        <div>
          Players{' '}
          <span className="text-terminal-text">
            {game.alivePlayers}/{game.playerCount}
          </span>
        </div>
        {game.winner && (
          <div className="col-span-2">
            Winner:{' '}
            <span
              className={clsx(
                'font-semibold',
                game.winner === 'mafia' ? 'text-terminal-red' : 'text-terminal-green',
              )}
            >
              {game.winner === 'mafia' ? '🔪 Mafia' : '🏆 Citizens'}
            </span>
          </div>
        )}
      </div>

      {showReplay && (
        <div className="mt-3 text-xs text-terminal-blue">
          View replay →
        </div>
      )}
    </a>
  );
}
