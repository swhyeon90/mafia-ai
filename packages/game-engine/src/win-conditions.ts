import type { InternalGameState, Team } from './types';

/**
 * Check whether the game has a winner.
 * Returns null if the game should continue.
 *
 * Rules:
 *   - Mafia wins when mafiaAlive >= nonMafiaAlive (parity or majority)
 *   - Citizens win when all mafia are eliminated
 */
export function checkWinCondition(state: InternalGameState): Team | null {
  const alivePlayers = state.players.filter((p) => p.isAlive);
  const aliveMafia = alivePlayers.filter((p) => p.role === 'mafia');
  const aliveNonMafia = alivePlayers.filter((p) => p.role !== 'mafia');

  if (aliveMafia.length === 0) return 'citizens';
  if (aliveMafia.length >= aliveNonMafia.length) return 'mafia';
  return null;
}

/** Convenience: count alive players by team */
export function getTeamCounts(state: InternalGameState): {
  mafiaAlive: number;
  citizensAlive: number;
  total: number;
} {
  const alive = state.players.filter((p) => p.isAlive);
  return {
    mafiaAlive: alive.filter((p) => p.role === 'mafia').length,
    citizensAlive: alive.filter((p) => p.role !== 'mafia').length,
    total: alive.length,
  };
}
