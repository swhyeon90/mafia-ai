import { v4 as uuidv4 } from 'uuid';
import type {
  InternalGameState,
  InternalPlayer,
  EngineAction,
  EngineResult,
  StoredEvent,
  Phase,
  NightAction,
  PlayerId,
} from './types';
import { assignRoles, hasNightAction } from './roles';
import { checkWinCondition } from './win-conditions';
import { phaseDuration } from './phase-transition';
import { DEFAULT_GAME_CONFIG } from '@mafia-ai/shared-types';
import type { GameConfig } from '@mafia-ai/shared-types';

// ─── Factory ────────────────────────────────────────────────────────────────

export function createGame(id: string, config: Partial<GameConfig> = {}): InternalGameState {
  const now = Date.now();
  const merged: GameConfig = { ...DEFAULT_GAME_CONFIG, ...config };
  return {
    id,
    status: 'waiting',
    phase: 'lobby',
    day: 0,
    players: [],
    votes: {},
    nightActions: {},
    messages: [],
    reasoningLogs: [],
    events: [],
    winner: null,
    phaseStartedAt: now,
    phaseDeadline: now + 3_600_000, // lobby can sit open for 1h
    config: merged,
    inspectionResults: {},
    saveHistory: {},
    pendingVoters: new Set(),
    pendingNightActors: new Set(),
  };
}

// ─── Main action dispatcher ──────────────────────────────────────────────────

export function applyAction(state: InternalGameState, action: EngineAction): EngineResult {
  switch (action.type) {
    case 'PLAYER_JOIN':
      return handlePlayerJoin(state, action);
    case 'GAME_START':
      return handleGameStart(state);
    case 'ADVANCE_PHASE':
      return handleAdvancePhase(state);
    case 'SEND_MESSAGE':
      return handleSendMessage(state, action);
    case 'CAST_VOTE':
      return handleCastVote(state, action);
    case 'SUBMIT_NIGHT_ACTION':
      return handleNightAction(state, action);
    default:
      return { state, events: [], error: 'Unknown action type' };
  }
}

// ─── Handlers ───────────────────────────────────────────────────────────────

function handlePlayerJoin(
  state: InternalGameState,
  action: Extract<EngineAction, { type: 'PLAYER_JOIN' }>,
): EngineResult {
  if (state.phase !== 'lobby') {
    return { state, events: [], error: 'Game already started' };
  }
  if (state.players.length >= state.config.maxPlayers) {
    return { state, events: [], error: 'Game is full' };
  }
  // Prevent same agent joining twice
  if (state.players.some((p) => p.agentId === action.agentId)) {
    return { state, events: [], error: 'Agent already in game' };
  }

  const player: InternalPlayer = {
    id: uuidv4(),
    agentId: action.agentId,
    agentName: action.agentName,
    role: 'citizen', // placeholder until roles assigned
    isAlive: true,
    seatIndex: state.players.length,
    model: action.model,
    personality: action.personality,
  };

  const event = makeEvent('PLAYER_JOINED', state.id, true, {
    playerId: player.id,
    agentName: player.agentName,
    model: player.model,
    personality: player.personality,
    seatIndex: player.seatIndex,
  });

  return {
    state: { ...state, players: [...state.players, player] },
    events: [event],
  };
}

function handleGameStart(state: InternalGameState): EngineResult {
  if (state.status !== 'waiting') {
    return { state, events: [], error: 'Game already started or finished' };
  }
  if (state.players.length < state.config.minPlayers) {
    return {
      state,
      events: [],
      error: `Need at least ${state.config.minPlayers} players`,
    };
  }

  const roles = assignRoles(state.players.length);
  const assignedPlayers: InternalPlayer[] = state.players.map((p, i) => ({
    ...p,
    role: roles[i]!,
  }));

  const now = Date.now();
  const duration = phaseDuration('role-assignment', state.config);

  const newState: InternalGameState = {
    ...state,
    status: 'active',
    phase: 'role-assignment',
    day: 1,
    players: assignedPlayers,
    phaseStartedAt: now,
    phaseDeadline: now + duration,
  };

  const events: StoredEvent[] = [
    makeEvent('GAME_STARTED', state.id, true, { playerCount: assignedPlayers.length }),
    makeEvent('PHASE_STARTED', state.id, true, {
      phase: 'role-assignment',
      day: 1,
      timeoutMs: duration,
    }),
  ];

  return { state: newState, events };
}

function handleAdvancePhase(state: InternalGameState): EngineResult {
  const events: StoredEvent[] = [];

  switch (state.phase) {
    case 'role-assignment':
      return transitionTo(state, 'discussion', events);

    case 'discussion':
      return transitionTo(state, 'voting', events);

    case 'voting': {
      // Resolve votes first
      const { state: afterVotes, events: voteEvents } = resolveVotes(state);
      events.push(...voteEvents);

      // Check win condition
      const winner = checkWinCondition(afterVotes);
      if (winner) {
        return finishGame(afterVotes, winner, events);
      }

      return transitionTo(afterVotes, 'night', events);
    }

    case 'night': {
      // Resolve night actions
      const { state: afterNight, events: nightEvents } = resolveNight(state);
      events.push(...nightEvents);

      // Check win condition
      const winner = checkWinCondition(afterNight);
      if (winner) {
        return finishGame(afterNight, winner, events);
      }

      // Start a new day
      return transitionTo({ ...afterNight, day: afterNight.day + 1 }, 'discussion', events);
    }

    default:
      return { state, events: [], error: `Cannot advance from phase: ${state.phase}` };
  }
}

function handleSendMessage(
  state: InternalGameState,
  action: Extract<EngineAction, { type: 'SEND_MESSAGE' }>,
): EngineResult {
  if (state.phase !== 'discussion') {
    return { state, events: [], error: 'Can only chat during discussion phase' };
  }

  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) return { state, events: [], error: 'Player not found' };
  if (!player.isAlive) return { state, events: [], error: 'Dead players cannot speak' };

  const content = action.content.trim().slice(0, 500);
  const id = uuidv4();
  const now = Date.now();

  const message = {
    id,
    playerId: player.id,
    content,
    timestamp: now,
    phase: state.phase as Phase,
    day: state.day,
    isMafiaChannel: false,
  };

  const reasoningLogs = action.reasoning
    ? [
        ...state.reasoningLogs,
        {
          id: uuidv4(),
          playerId: player.id,
          day: state.day,
          phase: state.phase as Phase,
          reasoning: action.reasoning,
          timestamp: now,
        },
      ]
    : state.reasoningLogs;

  const event = makeEvent('MESSAGE_SENT', state.id, true, {
    message: { ...message, playerName: player.agentName },
  });

  return {
    state: { ...state, messages: [...state.messages, message], reasoningLogs },
    events: [event],
  };
}

function handleCastVote(
  state: InternalGameState,
  action: Extract<EngineAction, { type: 'CAST_VOTE' }>,
): EngineResult {
  if (state.phase !== 'voting') {
    return { state, events: [], error: 'Not in voting phase' };
  }

  const voter = state.players.find((p) => p.id === action.voterId);
  if (!voter || !voter.isAlive) return { state, events: [], error: 'Invalid voter' };

  // Validate target
  if (action.targetId !== 'skip') {
    const target = state.players.find((p) => p.id === action.targetId);
    if (!target || !target.isAlive) return { state, events: [], error: 'Invalid vote target' };
    if (action.targetId === action.voterId) return { state, events: [], error: 'Cannot vote for yourself' };
  }

  const newVotes = { ...state.votes, [action.voterId]: action.targetId };

  // Remove from pending voters
  const pendingVoters = new Set(state.pendingVoters);
  pendingVoters.delete(action.voterId);

  const event = makeEvent('VOTE_CAST', state.id, true, {
    voterId: voter.id,
    voterName: voter.agentName,
    targetId: action.targetId,
  });

  const newState = { ...state, votes: newVotes, pendingVoters };
  const shouldAdvance = pendingVoters.size === 0;

  return { state: newState, events: [event], shouldAdvance };
}

function handleNightAction(
  state: InternalGameState,
  action: Extract<EngineAction, { type: 'SUBMIT_NIGHT_ACTION' }>,
): EngineResult {
  if (state.phase !== 'night') {
    return { state, events: [], error: 'Not in night phase' };
  }

  const player = state.players.find((p) => p.id === action.playerId);
  if (!player || !player.isAlive) return { state, events: [], error: 'Invalid player' };
  if (!hasNightAction(player.role)) {
    return { state, events: [], error: 'This role has no night action' };
  }

  // Validate target
  if (action.targetId !== null) {
    const target = state.players.find((p) => p.id === action.targetId);
    if (!target || !target.isAlive) return { state, events: [], error: 'Invalid night action target' };
  }

  const actionTypeMap: Record<string, NightAction['actionType']> = {
    mafia: 'kill',
    detective: 'inspect',
    doctor: 'save',
  };

  const nightAction: NightAction = {
    playerId: player.id,
    actionType: actionTypeMap[player.role] ?? 'skip',
    targetId: action.targetId,
  };

  const reasoningLogs = action.reasoning
    ? [
        ...state.reasoningLogs,
        {
          id: uuidv4(),
          playerId: player.id,
          day: state.day,
          phase: state.phase as Phase,
          reasoning: action.reasoning,
          timestamp: Date.now(),
        },
      ]
    : state.reasoningLogs;

  const pendingNightActors = new Set(state.pendingNightActors);
  pendingNightActors.delete(player.id);

  const newState = {
    ...state,
    nightActions: { ...state.nightActions, [player.id]: nightAction },
    reasoningLogs,
    pendingNightActors,
  };

  // Hidden event — private, revealed post-game
  const event = makeEvent('NIGHT_ACTION_SUBMITTED', state.id, false, { role: player.role });

  const shouldAdvance = pendingNightActors.size === 0;

  return { state: newState, events: [event], shouldAdvance };
}

// ─── Resolution helpers ──────────────────────────────────────────────────────

function resolveVotes(state: InternalGameState): { state: InternalGameState; events: StoredEvent[] } {
  const events: StoredEvent[] = [];
  const alivePlayers = state.players.filter((p) => p.isAlive);

  // Count votes
  const voteCounts: Record<PlayerId, number> = {};
  for (const [, targetId] of Object.entries(state.votes)) {
    if (targetId !== 'skip') {
      voteCounts[targetId] = (voteCounts[targetId] ?? 0) + 1;
    }
  }

  // Find player with most votes; must exceed simple majority
  const majority = Math.floor(alivePlayers.length / 2) + 1;
  let eliminatedId: PlayerId | null = null;
  let maxVotes = 0;

  for (const [targetId, count] of Object.entries(voteCounts)) {
    if (count > maxVotes) {
      maxVotes = count;
      eliminatedId = targetId;
    } else if (count === maxVotes) {
      eliminatedId = null; // tie = no elimination
    }
  }

  if (maxVotes < majority) eliminatedId = null;

  let players = state.players;
  if (eliminatedId) {
    players = state.players.map((p) =>
      p.id === eliminatedId ? { ...p, isAlive: false } : p,
    );
  }

  const eliminated = eliminatedId
    ? state.players.find((p) => p.id === eliminatedId) ?? null
    : null;

  events.push(
    makeEvent('VOTES_RESOLVED', state.id, true, {
      eliminated: eliminatedId,
      eliminatedName: eliminated?.agentName ?? null,
      eliminatedRole: eliminated?.role ?? null,
      tally: voteCounts,
    }),
  );

  if (eliminatedId && eliminated) {
    events.push(
      makeEvent('PLAYER_ELIMINATED', state.id, true, {
        playerId: eliminatedId,
        playerName: eliminated.agentName,
        role: eliminated.role,
        method: 'vote',
        day: state.day,
      }),
    );
  }

  return { state: { ...state, players, votes: {} }, events };
}

function resolveNight(state: InternalGameState): { state: InternalGameState; events: StoredEvent[] } {
  const events: StoredEvent[] = [];
  const actions = Object.values(state.nightActions);

  const killAction = actions.find((a) => a.actionType === 'kill');
  const saveAction = actions.find((a) => a.actionType === 'save');
  const inspectAction = actions.find((a) => a.actionType === 'inspect');

  let players = state.players;
  let killedId: PlayerId | null = null;
  let saved = false;

  // Resolve kill (doctor save blocks it)
  if (killAction?.targetId) {
    if (saveAction?.targetId === killAction.targetId) {
      saved = true; // saved!
    } else {
      killedId = killAction.targetId;
      players = state.players.map((p) => (p.id === killedId ? { ...p, isAlive: false } : p));
    }
  }

  // Update inspection results
  let inspectionResults = { ...state.inspectionResults };
  let saveHistoryMap = { ...state.saveHistory };

  if (inspectAction?.targetId && inspectAction.playerId) {
    const target = state.players.find((p) => p.id === inspectAction.targetId);
    if (target) {
      const prev = inspectionResults[inspectAction.playerId] ?? [];
      inspectionResults[inspectAction.playerId] = [
        ...prev,
        { day: state.day, targetId: inspectAction.targetId, role: target.role },
      ];
    }
  }

  if (saveAction?.targetId && saveAction.playerId) {
    const prev = saveHistoryMap[saveAction.playerId] ?? [];
    saveHistoryMap[saveAction.playerId] = [
      ...prev,
      { day: state.day, targetId: saveAction.targetId },
    ];
  }

  const killed = killedId ? state.players.find((p) => p.id === killedId) ?? null : null;

  events.push(
    makeEvent('NIGHT_RESOLVED', state.id, true, {
      killed: killedId,
      killedName: killed?.agentName ?? null,
      killedRole: killed?.role ?? null,
      saved,
    }),
  );

  if (killedId && killed) {
    events.push(
      makeEvent('PLAYER_ELIMINATED', state.id, true, {
        playerId: killedId,
        playerName: killed.agentName,
        role: killed.role,
        method: 'night-kill',
        day: state.day,
      }),
    );
  }

  return {
    state: {
      ...state,
      players,
      nightActions: {},
      inspectionResults,
      saveHistory: saveHistoryMap,
    },
    events,
  };
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

function transitionTo(
  state: InternalGameState,
  phase: Phase,
  existingEvents: StoredEvent[],
): EngineResult {
  const now = Date.now();
  const duration = phaseDuration(phase, state.config);

  // Compute pending actors for the new phase
  const pendingVoters =
    phase === 'voting'
      ? new Set(state.players.filter((p) => p.isAlive).map((p) => p.id))
      : new Set<PlayerId>();

  const pendingNightActors =
    phase === 'night'
      ? new Set(
          state.players
            .filter((p) => p.isAlive && hasNightAction(p.role))
            .map((p) => p.id),
        )
      : new Set<PlayerId>();

  const newState: InternalGameState = {
    ...state,
    phase,
    phaseStartedAt: now,
    phaseDeadline: now + duration,
    pendingVoters,
    pendingNightActors,
  };

  const phaseEvent = makeEvent('PHASE_STARTED', state.id, true, {
    phase,
    day: newState.day,
    timeoutMs: duration,
  });

  return { state: newState, events: [...existingEvents, phaseEvent] };
}

function finishGame(
  state: InternalGameState,
  winner: NonNullable<InternalGameState['winner']>,
  existingEvents: StoredEvent[],
): EngineResult {
  const now = Date.now();
  const finishedState: InternalGameState = {
    ...state,
    status: 'finished',
    phase: 'finished',
    winner,
    phaseDeadline: now,
  };

  const roles: Record<string, string> = {};
  for (const p of state.players) roles[p.id] = p.role;

  const events: StoredEvent[] = [
    ...existingEvents,
    makeEvent('GAME_FINISHED', state.id, true, {
      winner,
      day: state.day,
      survivingPlayers: state.players.filter((p) => p.isAlive).map((p) => p.id),
    }),
    makeEvent('ROLES_REVEALED', state.id, true, { roles }),
  ];

  return { state: finishedState, events };
}

function makeEvent(
  type: string,
  gameId: string,
  isPublic: boolean,
  payload: unknown,
): StoredEvent {
  return {
    id: uuidv4(),
    type,
    payload,
    timestamp: Date.now(),
    isPublic,
  };
}
