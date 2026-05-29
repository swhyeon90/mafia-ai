'use client';

import { useState, useMemo } from 'react';
import type { ReplayData, GameEvent, ReasoningLog } from '@mafia-ai/shared-types';
import { ROLE_COLORS, ROLE_EMOJIS, formatTimestamp, PHASE_LABELS } from '@/lib/formatters';
import { clsx } from 'clsx';
import type { Role } from '@mafia-ai/shared-types';

interface Props {
  gameId: string;
  replay: ReplayData;
}

export function ReplayViewer({ gameId, replay }: Props) {
  const [cursor, setCursor] = useState(replay.events.length - 1);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [showReasoning, setShowReasoning] = useState(false);

  const visibleEvents = useMemo(
    () => replay.events.slice(0, cursor + 1) as GameEvent[],
    [cursor, replay.events],
  );

  const playerReasoningLogs = useMemo(() => {
    if (!selectedPlayer) return [];
    return replay.reasoningLogs.filter((l: ReasoningLog) => l.playerId === selectedPlayer);
  }, [selectedPlayer, replay.reasoningLogs]);

  const game = replay.game;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href={`/games/${gameId}`} className="text-xs text-terminal-muted hover:text-terminal-text">
            ← Live view
          </a>
          <a href="/" className="text-xs text-terminal-muted hover:text-terminal-text">
            Home
          </a>
        </div>
        <div className="text-sm font-semibold">
          📼 Replay — Game {gameId.slice(0, 12)}...
        </div>
        {game.winner && (
          <div
            className={clsx(
              'text-sm font-bold',
              game.winner === 'mafia' ? 'text-terminal-red' : 'text-terminal-green',
            )}
          >
            {game.winner === 'mafia' ? '🔪 Mafia Won' : '🏆 Citizens Won'}
          </div>
        )}
      </div>

      {/* Timeline scrubber */}
      <div className="border border-terminal-border rounded p-3">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-xs text-terminal-muted">Timeline</span>
          <span className="text-xs text-terminal-text">
            {cursor + 1} / {replay.events.length} events
          </span>
          <button
            onClick={() => setCursor(0)}
            className="text-xs text-terminal-muted hover:text-terminal-text px-2 py-0.5 border border-terminal-border rounded"
          >
            ⏮
          </button>
          <button
            onClick={() => setCursor(Math.max(0, cursor - 1))}
            className="text-xs text-terminal-muted hover:text-terminal-text px-2 py-0.5 border border-terminal-border rounded"
          >
            ‹
          </button>
          <button
            onClick={() => setCursor(Math.min(replay.events.length - 1, cursor + 1))}
            className="text-xs text-terminal-muted hover:text-terminal-text px-2 py-0.5 border border-terminal-border rounded"
          >
            ›
          </button>
          <button
            onClick={() => setCursor(replay.events.length - 1)}
            className="text-xs text-terminal-muted hover:text-terminal-text px-2 py-0.5 border border-terminal-border rounded"
          >
            ⏭
          </button>
        </div>
        <input
          type="range"
          min={0}
          max={replay.events.length - 1}
          value={cursor}
          onChange={(e) => setCursor(Number(e.target.value))}
          className="w-full accent-terminal-green"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ minHeight: '60vh' }}>
        {/* Event log */}
        <div className="lg:col-span-2 border border-terminal-border rounded p-4 overflow-y-auto max-h-[60vh]">
          <div className="text-xs text-terminal-muted mb-3 font-semibold">EVENT LOG</div>
          <div className="space-y-1">
            {visibleEvents.map((event, i) => (
              <EventRow key={event.id} event={event} isLatest={i === cursor} />
            ))}
          </div>
        </div>

        {/* Player panel */}
        <div className="border border-terminal-border rounded p-4 overflow-y-auto max-h-[60vh]">
          <div className="text-xs text-terminal-muted mb-3 font-semibold">
            PLAYERS (roles revealed)
          </div>
          <div className="space-y-1 mb-4">
            {game.players.map((p: any) => (
              <button
                key={p.id}
                onClick={() => {
                  setSelectedPlayer(selectedPlayer === p.id ? null : p.id);
                  setShowReasoning(true);
                }}
                className={clsx(
                  'w-full flex items-center gap-2 p-2 rounded text-left transition-colors',
                  selectedPlayer === p.id
                    ? 'bg-terminal-border'
                    : 'hover:bg-terminal-border/40',
                )}
              >
                <div
                  className={clsx(
                    'w-5 h-5 rounded text-xs flex items-center justify-center font-bold',
                    p.isAlive ? 'bg-terminal-surface' : 'opacity-40',
                  )}
                >
                  {p.agentName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className={clsx(
                      'text-xs font-medium truncate',
                      !p.isAlive && 'line-through text-terminal-muted',
                    )}
                  >
                    {p.agentName}
                  </div>
                  {p.role && (
                    <div className={clsx('text-xs', ROLE_COLORS[p.role as Role])}>
                      {ROLE_EMOJIS[p.role as Role]} {p.role}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Reasoning logs for selected player */}
          {selectedPlayer && showReasoning && playerReasoningLogs.length > 0 && (
            <div>
              <div className="text-xs text-terminal-purple mb-2 font-semibold border-t border-terminal-border pt-2">
                🧠 INTERNAL REASONING
              </div>
              <div className="space-y-2">
                {playerReasoningLogs.map((log: ReasoningLog) => (
                  <div key={log.id} className="text-xs border border-terminal-border rounded p-2">
                    <div className="text-terminal-muted mb-1">
                      Day {log.day} · {PHASE_LABELS[log.phase] ?? log.phase}
                    </div>
                    <div className="text-terminal-text italic">{log.reasoning}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {selectedPlayer && playerReasoningLogs.length === 0 && (
            <div className="text-xs text-terminal-muted italic">No reasoning logs recorded.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function EventRow({ event, isLatest }: { event: GameEvent; isLatest: boolean }) {
  const colors: Record<string, string> = {
    PHASE_STARTED: 'text-terminal-purple',
    PLAYER_ELIMINATED: 'text-terminal-red',
    VOTES_RESOLVED: 'text-terminal-yellow',
    NIGHT_RESOLVED: 'text-terminal-purple',
    GAME_FINISHED: 'text-terminal-green font-bold',
    MESSAGE_SENT: 'text-terminal-text',
    VOTE_CAST: 'text-terminal-muted',
    GAME_STARTED: 'text-terminal-green',
    PLAYER_JOINED: 'text-terminal-blue',
    ROLES_REVEALED: 'text-terminal-yellow',
  };

  const color = colors[event.type] ?? 'text-terminal-muted';
  const payload = event.payload as Record<string, unknown>;

  let description = event.type;

  switch (event.type) {
    case 'PHASE_STARTED':
      description = `📍 Day ${payload.day} — ${PHASE_LABELS[payload.phase as string] ?? payload.phase} started`;
      break;
    case 'MESSAGE_SENT': {
      const msg = payload.message as { playerName: string; content: string } | undefined;
      description = msg ? `${msg.playerName}: "${msg.content}"` : 'MESSAGE_SENT';
      break;
    }
    case 'VOTE_CAST':
      description = `${payload.voterName} voted for ${payload.targetId === 'skip' ? '[skip]' : payload.targetId}`;
      break;
    case 'PLAYER_ELIMINATED':
      description = `💀 ${payload.playerName} eliminated (${payload.role}) by ${payload.method}`;
      break;
    case 'VOTES_RESOLVED':
      description = payload.eliminated
        ? `🗳 Vote resolved: ${payload.eliminatedName} eliminated`
        : '🗳 Vote resolved: no majority, no elimination';
      break;
    case 'NIGHT_RESOLVED':
      description = payload.killed
        ? `🌙 Night resolved: ${payload.killedName} was killed`
        : '🌙 Night resolved: no one was killed';
      break;
    case 'GAME_FINISHED':
      description = `🏁 GAME OVER — ${payload.winner === 'mafia' ? '🔪 Mafia wins' : '🏆 Citizens win'}`;
      break;
    case 'GAME_STARTED':
      description = `🎮 Game started with ${payload.playerCount} players`;
      break;
  }

  return (
    <div
      className={clsx(
        'text-xs py-0.5 border-l-2 pl-2 transition-all',
        isLatest ? 'border-terminal-green' : 'border-transparent',
        color,
      )}
    >
      <span className="text-terminal-muted mr-2">[{formatTimestamp(event.timestamp)}]</span>
      {description}
    </div>
  );
}
