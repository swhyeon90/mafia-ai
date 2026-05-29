import { describe, it, expect } from 'vitest';
import { assignRoles } from '../roles';

describe('assignRoles', () => {
  it('throws for fewer than 4 players', () => {
    expect(() => assignRoles(3)).toThrow('Need at least 4 players');
  });

  it('assigns 1 mafia, 1 detective, 1 doctor for 4 players', () => {
    const roles = assignRoles(4);
    expect(roles).toHaveLength(4);
    expect(roles.filter((r) => r === 'mafia')).toHaveLength(1);
    expect(roles.filter((r) => r === 'detective')).toHaveLength(1);
    expect(roles.filter((r) => r === 'doctor')).toHaveLength(1);
    expect(roles.filter((r) => r === 'citizen')).toHaveLength(1);
  });

  it('assigns 2 mafia for 6 players', () => {
    const roles = assignRoles(6);
    expect(roles.filter((r) => r === 'mafia')).toHaveLength(2);
    expect(roles.filter((r) => r === 'detective')).toHaveLength(1);
    expect(roles.filter((r) => r === 'doctor')).toHaveLength(1);
    expect(roles.filter((r) => r === 'citizen')).toHaveLength(2);
  });

  it('assigns 3 mafia for 8 players', () => {
    const roles = assignRoles(8);
    expect(roles.filter((r) => r === 'mafia')).toHaveLength(3);
    expect(roles).toHaveLength(8);
  });

  it('returns shuffled roles (rarely same order)', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) {
      seen.add(assignRoles(5).join(','));
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});
