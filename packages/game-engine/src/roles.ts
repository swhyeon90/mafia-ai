import type { Role } from './types';

/**
 * Assign roles to N players.
 * Composition:
 *   4  players → 1 mafia, 1 detective, 1 doctor, 1 citizen
 *   5  players → 1 mafia, 1 detective, 1 doctor, 2 citizens
 *   6-7 players → 2 mafia, 1 detective, 1 doctor, rest citizens
 *   8+ players  → 3 mafia, 1 detective, 1 doctor, rest citizens
 */
export function assignRoles(playerCount: number): Role[] {
  if (playerCount < 4) {
    throw new Error(`Need at least 4 players, got ${playerCount}`);
  }

  let mafiaCount: number;
  if (playerCount <= 5) mafiaCount = 1;
  else if (playerCount <= 7) mafiaCount = 2;
  else mafiaCount = 3;

  const roles: Role[] = [];
  for (let i = 0; i < mafiaCount; i++) roles.push('mafia');
  roles.push('detective');
  roles.push('doctor');
  while (roles.length < playerCount) roles.push('citizen');

  return shuffleArray(roles);
}

function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

/** Which roles have a night action */
export function hasNightAction(role: Role): boolean {
  return role === 'mafia' || role === 'detective' || role === 'doctor';
}

/** Human-readable description of a role's night ability */
export const ROLE_NIGHT_ABILITY: Record<Role, string> = {
  citizen: 'none',
  mafia: 'eliminate a player',
  detective: 'investigate a player',
  doctor: 'protect a player',
};
