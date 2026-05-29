import { describe, it, expect, beforeEach } from 'vitest';
import { createGame, applyAction } from '../state-machine';
import type { InternalGameState } from '../types';

// Helper to add N players
function addPlayers(state: InternalGameState, count: number): InternalGameState {
  let s = state;
  for (let i = 0; i < count; i++) {
    const r = applyAction(s, {
      type: 'PLAYER_JOIN',
      agentId: `agent-${i}`,
      agentName: `Agent-${i}`,
      model: 'test-model',
      personality: 'neutral',
    });
    expect(r.error).toBeUndefined();
    s = r.state;
  }
  return s;
}

describe('createGame', () => {
  it('creates game in lobby phase with default config', () => {
    const game = createGame('g1');
    expect(game.id).toBe('g1');
    expect(game.phase).toBe('lobby');
    expect(game.status).toBe('waiting');
    expect(game.players).toHaveLength(0);
    expect(game.day).toBe(0);
  });
});

describe('PLAYER_JOIN', () => {
  it('adds a player and emits PLAYER_JOINED event', () => {
    const state = createGame('g1');
    const result = applyAction(state, {
      type: 'PLAYER_JOIN',
      agentId: 'agent-1',
      agentName: 'Alice',
      model: 'claude',
      personality: 'aggressive',
    });
    expect(result.error).toBeUndefined();
    expect(result.state.players).toHaveLength(1);
    expect(result.state.players[0]!.agentName).toBe('Alice');
    expect(result.events).toHaveLength(1);
    expect(result.events[0]!.type).toBe('PLAYER_JOINED');
  });

  it('rejects joining after game started', () => {
    let state = addPlayers(createGame('g1'), 4);
    state = applyAction(state, { type: 'GAME_START' }).state;
    const result = applyAction(state, {
      type: 'PLAYER_JOIN',
      agentId: 'late-agent',
      agentName: 'Late',
      model: 'gpt',
      personality: 'neutral',
    });
    expect(result.error).toBe('Game already started');
  });

  it('rejects duplicate agent', () => {
    let state = createGame('g1');
    state = applyAction(state, {
      type: 'PLAYER_JOIN',
      agentId: 'agent-1',
      agentName: 'Alice',
      model: 'claude',
      personality: 'neutral',
    }).state;
    const result = applyAction(state, {
      type: 'PLAYER_JOIN',
      agentId: 'agent-1',
      agentName: 'Alice Again',
      model: 'claude',
      personality: 'neutral',
    });
    expect(result.error).toBe('Agent already in game');
  });
});

describe('GAME_START', () => {
  it('starts game and assigns roles', () => {
    let state = addPlayers(createGame('g1'), 5);
    const result = applyAction(state, { type: 'GAME_START' });
    expect(result.error).toBeUndefined();
    expect(result.state.status).toBe('active');
    expect(result.state.phase).toBe('role-assignment');
    expect(result.state.day).toBe(1);
    // 5 players: 1 mafia, 1 detective, 1 doctor, 2 citizens
    const roles = result.state.players.map((p) => p.role);
    expect(roles.filter((r) => r === 'mafia')).toHaveLength(1);
    expect(roles.filter((r) => r === 'detective')).toHaveLength(1);
    expect(roles.filter((r) => r === 'doctor')).toHaveLength(1);
    expect(roles.filter((r) => r === 'citizen')).toHaveLength(2);
  });

  it('rejects start with too few players', () => {
    let state = addPlayers(createGame('g1'), 3);
    const result = applyAction(state, { type: 'GAME_START' });
    expect(result.error).toContain('at least');
  });
});

describe('SEND_MESSAGE', () => {
  let activeGame: InternalGameState;

  beforeEach(() => {
    let s = addPlayers(createGame('g1'), 5);
    s = applyAction(s, { type: 'GAME_START' }).state;
    // Manually advance to discussion
    s = { ...s, phase: 'discussion' };
    activeGame = s;
  });

  it('records a message and emits MESSAGE_SENT', () => {
    const player = activeGame.players[0]!;
    const result = applyAction(activeGame, {
      type: 'SEND_MESSAGE',
      playerId: player.id,
      content: 'Hello everyone!',
    });
    expect(result.error).toBeUndefined();
    expect(result.state.messages).toHaveLength(1);
    expect(result.state.messages[0]!.content).toBe('Hello everyone!');
    expect(result.events[0]!.type).toBe('MESSAGE_SENT');
  });

  it('rejects message outside discussion phase', () => {
    const state = { ...activeGame, phase: 'voting' as const };
    const player = activeGame.players[0]!;
    const result = applyAction(state, {
      type: 'SEND_MESSAGE',
      playerId: player.id,
      content: 'Too late',
    });
    expect(result.error).toBe('Can only chat during discussion phase');
  });

  it('rejects message from dead player', () => {
    const player = activeGame.players[0]!;
    const state = {
      ...activeGame,
      players: activeGame.players.map((p) =>
        p.id === player.id ? { ...p, isAlive: false } : p,
      ),
    };
    const result = applyAction(state, {
      type: 'SEND_MESSAGE',
      playerId: player.id,
      content: 'Boo',
    });
    expect(result.error).toBe('Dead players cannot speak');
  });

  it('stores reasoning privately', () => {
    const player = activeGame.players[0]!;
    const result = applyAction(activeGame, {
      type: 'SEND_MESSAGE',
      playerId: player.id,
      content: 'I am suspicious',
      reasoning: 'I know they are mafia',
    });
    expect(result.state.reasoningLogs).toHaveLength(1);
    expect(result.state.reasoningLogs[0]!.reasoning).toBe('I know they are mafia');
  });
});

describe('CAST_VOTE', () => {
  let votingGame: InternalGameState;

  beforeEach(() => {
    let s = addPlayers(createGame('g1'), 5);
    s = applyAction(s, { type: 'GAME_START' }).state;
    s = { ...s, phase: 'voting' };
    // Initialize pending voters
    s = {
      ...s,
      pendingVoters: new Set(s.players.filter((p) => p.isAlive).map((p) => p.id)),
    };
    votingGame = s;
  });

  it('records a vote and emits VOTE_CAST', () => {
    const voter = votingGame.players[0]!;
    const target = votingGame.players[1]!;
    const result = applyAction(votingGame, {
      type: 'CAST_VOTE',
      voterId: voter.id,
      targetId: target.id,
    });
    expect(result.error).toBeUndefined();
    expect(result.state.votes[voter.id]).toBe(target.id);
    expect(result.events[0]!.type).toBe('VOTE_CAST');
  });

  it('allows skip vote', () => {
    const voter = votingGame.players[0]!;
    const result = applyAction(votingGame, {
      type: 'CAST_VOTE',
      voterId: voter.id,
      targetId: 'skip',
    });
    expect(result.error).toBeUndefined();
    expect(result.state.votes[voter.id]).toBe('skip');
  });

  it('sets shouldAdvance when all voted', () => {
    let s = votingGame;
    for (let i = 0; i < s.players.length - 1; i++) {
      const voter = s.players[i]!;
      const target = s.players[(i + 1) % s.players.length]!;
      s = applyAction(s, { type: 'CAST_VOTE', voterId: voter.id, targetId: target.id }).state;
    }
    // Last vote
    const lastVoter = s.players[s.players.length - 1]!;
    const target = s.players[0]!;
    const result = applyAction(s, {
      type: 'CAST_VOTE',
      voterId: lastVoter.id,
      targetId: target.id,
    });
    expect(result.shouldAdvance).toBe(true);
  });
});

describe('ADVANCE_PHASE (vote resolution)', () => {
  it('eliminates player with majority votes', () => {
    // 5 players, 3 vote for player[0]
    let s = addPlayers(createGame('g1'), 5);
    s = applyAction(s, { type: 'GAME_START' }).state;
    s = {
      ...s,
      phase: 'voting',
      pendingVoters: new Set(s.players.map((p) => p.id)),
    };

    const target = s.players[0]!;
    for (let i = 1; i <= 3; i++) {
      s = applyAction(s, {
        type: 'CAST_VOTE',
        voterId: s.players[i]!.id,
        targetId: target.id,
      }).state;
    }
    // Two skip
    for (let i = 4; i < 5; i++) {
      s = applyAction(s, {
        type: 'CAST_VOTE',
        voterId: s.players[i]!.id,
        targetId: 'skip',
      }).state;
    }

    const result = applyAction(s, { type: 'ADVANCE_PHASE' });
    const eliminated = result.state.players.find((p) => p.id === target.id);
    expect(eliminated?.isAlive).toBe(false);
    expect(result.events.some((e) => e.type === 'PLAYER_ELIMINATED')).toBe(true);
  });

  it('does not eliminate on tie', () => {
    let s = addPlayers(createGame('g1'), 4);
    s = applyAction(s, { type: 'GAME_START' }).state;
    s = {
      ...s,
      phase: 'voting',
      pendingVoters: new Set(s.players.map((p) => p.id)),
    };

    // p0 votes p2, p1 votes p2, p2 votes p0, p3 votes p0 → tie 2/2
    s = applyAction(s, { type: 'CAST_VOTE', voterId: s.players[0]!.id, targetId: s.players[2]!.id }).state;
    s = applyAction(s, { type: 'CAST_VOTE', voterId: s.players[1]!.id, targetId: s.players[2]!.id }).state;
    s = applyAction(s, { type: 'CAST_VOTE', voterId: s.players[2]!.id, targetId: s.players[0]!.id }).state;
    s = applyAction(s, { type: 'CAST_VOTE', voterId: s.players[3]!.id, targetId: s.players[0]!.id }).state;

    const result = applyAction(s, { type: 'ADVANCE_PHASE' });
    expect(result.state.players.every((p) => p.isAlive)).toBe(true);
  });
});
