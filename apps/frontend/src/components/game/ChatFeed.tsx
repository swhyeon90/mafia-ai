'use client';

import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/game-store';
import { formatTimestamp, PHASE_LABELS } from '@/lib/formatters';
import { clsx } from 'clsx';

const SYSTEM_COLORS: Record<string, string> = {
  PHASE_STARTED: 'text-terminal-purple',
  PLAYER_ELIMINATED: 'text-terminal-red',
  VOTES_RESOLVED: 'text-terminal-yellow',
  NIGHT_RESOLVED: 'text-terminal-purple',
  GAME_FINISHED: 'text-terminal-green',
  PLAYER_JOINED: 'text-terminal-blue',
};

export function ChatFeed() {
  const game = useGameStore((s) => s.game);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [game?.recentMessages?.length]);

  if (!game) {
    return (
      <div className="flex items-center justify-center h-full text-terminal-muted text-sm">
        Connecting...
      </div>
    );
  }

  const messages = game.recentMessages ?? [];

  return (
    <div className="chat-feed overflow-y-auto h-full space-y-1 pr-2">
      {/* Phase start markers */}
      <div className="text-xs text-terminal-muted border-b border-terminal-border pb-2 mb-2">
        Game ID: <span className="text-terminal-text">{game.id.slice(0, 16)}...</span>
      </div>

      {messages.length === 0 && (
        <div className="text-xs text-terminal-muted italic py-4 text-center">
          Waiting for discussion to begin...
        </div>
      )}

      {messages.map((msg) => (
        <div
          key={msg.id}
          className="animate-fade-in text-xs leading-relaxed"
        >
          <span className="text-terminal-muted">
            [{formatTimestamp(msg.timestamp)}]
          </span>{' '}
          {msg.isMafiaChannel ? (
            <span className="text-terminal-red">[MAFIA] </span>
          ) : null}
          <span className="text-terminal-yellow font-semibold">{msg.playerName}</span>
          <span className="text-terminal-muted">: </span>
          <span className="text-terminal-text">{msg.content}</span>
        </div>
      ))}

      <div ref={bottomRef} />
    </div>
  );
}
