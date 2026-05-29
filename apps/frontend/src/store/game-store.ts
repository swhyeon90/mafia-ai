'use client';

import { create } from 'zustand';
import type { GameView, ChatMessage, PlayerView } from '@mafia-ai/shared-types';

interface GameStore {
  game: GameView | null;
  connected: boolean;
  spectatorCount: number;
  // Actions
  setGame: (game: GameView) => void;
  updateFromEvent: (event: { type: string; payload: Record<string, unknown> }) => void;
  setConnected: (v: boolean) => void;
  setSpectatorCount: (n: number) => void;
}

export const useGameStore = create<GameStore>((set) => ({
  game: null,
  connected: false,
  spectatorCount: 0,

  setGame: (game) => set({ game }),

  setConnected: (connected) => set({ connected }),

  setSpectatorCount: (spectatorCount) => set({ spectatorCount }),

  updateFromEvent: (event) => {
    set((state) => {
      if (!state.game) return state;
      const game = { ...state.game };

      switch (event.type) {
        case 'PHASE_STARTED': {
          const p = event.payload as { phase: string; day: number; timeoutMs: number };
          game.phase = p.phase;
          game.day = p.day;
          game.phaseDeadline = Date.now() + p.timeoutMs;
          game.voteTally = {};
          return { game };
        }

        case 'MESSAGE_SENT': {
          const msg = (event.payload as { message: ChatMessage }).message;
          const messages = [...(game.recentMessages ?? []), msg].slice(-50);
          return { game: { ...game, recentMessages: messages } };
        }

        case 'VOTE_CAST': {
          const { targetId } = event.payload as { targetId: string };
          if (targetId && targetId !== 'skip') {
            const tally = { ...game.voteTally };
            tally[targetId] = (tally[targetId] ?? 0) + 1;
            return { game: { ...game, voteTally: tally } };
          }
          return state;
        }

        case 'PLAYER_ELIMINATED': {
          const { playerId } = event.payload as { playerId: string };
          const players = game.players.map((p: PlayerView) =>
            p.id === playerId ? { ...p, isAlive: false } : p,
          );
          return { game: { ...game, players } };
        }

        case 'GAME_FINISHED': {
          const { winner } = event.payload as { winner: string };
          return {
            game: { ...game, status: 'finished', winner: winner as 'mafia' | 'citizens', phase: 'finished' },
          };
        }

        case 'ROLES_REVEALED': {
          const { roles } = event.payload as { roles: Record<string, string> };
          const players = game.players.map((p: PlayerView) => ({
            ...p,
            role: (roles[p.id] as any) ?? p.role,
          }));
          return { game: { ...game, players } };
        }

        default:
          return state;
      }
    });
  },
}));
