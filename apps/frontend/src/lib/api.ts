import type { GameSummary, GameView, ReplayData } from '@mafia-ai/shared-types';

const BASE_URL =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_GAME_SERVER_URL ?? 'http://localhost:3001')
    : (process.env.NEXT_PUBLIC_GAME_SERVER_URL ?? 'http://localhost:3001');

export const WS_BASE =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_GAME_SERVER_WS ?? 'ws://localhost:3001')
    : 'ws://localhost:3001';

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

export const api = {
  listGames(status?: string): Promise<{ games: GameSummary[]; total: number }> {
    const qs = status ? `?status=${status}` : '';
    return fetchJson(`/games${qs}`);
  },

  getGame(gameId: string): Promise<GameView> {
    return fetchJson(`/games/${gameId}`);
  },

  getReplay(gameId: string): Promise<ReplayData> {
    return fetchJson(`/games/${gameId}/replay`);
  },
};
