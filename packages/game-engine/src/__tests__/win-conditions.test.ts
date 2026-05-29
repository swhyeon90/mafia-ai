import { describe, it, expect } from 'vitest';
import { checkWinCondition } from '../win-conditions';
import { createGame, applyAction } from '../state-machine';
import type { InternalGameState } from '../types';

function makeState(
  playerRoles: Array<{ role: 'citizen' | 'mafia' | 'detective' | 'doctor'; isAlive: boolean }>,
): InternalGameState {
  let state = createGame('test');
  for (let i = 0; i < playerRoles.length; i++) {
    const r = applyAction(state, {
      type: 'PLAYER_JOIN',
      agentId: `a${i}`,
      agentName: `P${i}`,
      model: 'm',
      personality: 'n',
    });
    state = r.state;
  }
  // Override roles and alive status
  state = {
    ...state,
    players: state.players.map((p, i) => ({
      ...p,
      role: playerRoles[i]!.role,
      isAlive: playerRoles[i]!.isAlive,
    })),
  };
  return state;
}

describe('checkWinCondition', () => {
  it('citizens win when all mafia eliminated', () => {
    const s = makeState([
      { role: 'mafia', isAlive: false },
      { role: 'citizen', isAlive: true },
      { role: 'detective', isAlive: true },
      { role: 'doctor', isAlive: true },
    ]);
    expect(checkWinCondition(s)).toBe('citizens');
  });

  it('mafia wins at parity (1 mafia, 1 citizen)', () => {
    const s = makeState([
      { role: 'mafia', isAlive: true },
      { role: 'citizen', isAlive: true },
    ]);
    expect(checkWinCondition(s)).toBe('mafia');
  });

  it('mafia wins when outnumbering non-mafia', () => {
    const s = makeState([
      { role: 'mafia', isAlive: true },
      { role: 'mafia', isAlive: true },
      { role: 'citizen', isAlive: true },
    ]);
    expect(checkWinCondition(s)).toBe('mafia');
  });

  it('no winner when citizens outnumber mafia', () => {
    const s = makeState([
      { role: 'mafia', isAlive: true },
      { role: 'citizen', isAlive: true },
      { role: 'citizen', isAlive: true },
      { role: 'detective', isAlive: true },
    ]);
    expect(checkWinCondition(s)).toBeNull();
  });

  it('citizens win when last 2 alive are both non-mafia', () => {
    const s = makeState([
      { role: 'mafia', isAlive: false },
      { role: 'mafia', isAlive: false },
      { role: 'citizen', isAlive: true },
      { role: 'doctor', isAlive: true },
    ]);
    expect(checkWinCondition(s)).toBe('citizens');
  });
});
