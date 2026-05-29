import { v4 as uuidv4 } from 'uuid';
import {
  createGame,
  applyAction,
} from '@mafia-ai/game-engine';
import type { InternalGameState, EngineAction, StoredEvent } from '@mafia-ai/game-engine';
import type {
  AgentGameView,
  GameView,
  PlayerView,
  ChatMessage,
  GameSummary,
  ReplayData,
  Team,
} from '@mafia-ai/shared-types';
import type { AnyGameEvent } from '@mafia-ai/event-schema';
import { store } from '../store/memory-store';
import { wsManager } from '../ws/ws-manager';
import { config } from '../config';

export class GameService {
  private phaseTimers = new Map<string, NodeJS.Timeout>();

  // ─── Create & join ──────────────────────────────────────────────────────────

  createGame(): { gameId: string } {
    const gameId = uuidv4();
    const state = createGame(gameId, {
      minPlayers: config.minPlayersToStart,
      maxPlayers: config.maxPlayersPerGame,
    });
    store.createGame(state);
    return { gameId };
  }

  joinGame(
    gameId: string,
    agentId: string,
  ): { playerId: string; seatIndex: number } | { error: string } {
    const record = store.getGame(gameId);
    if (!record) return { error: 'Game not found' };

    const agent = store.getAgent(agentId);
    if (!agent) return { error: 'Agent not found' };

    const result = applyAction(record.state, {
      type: 'PLAYER_JOIN',
      agentId,
      agentName: agent.agentName,
      model: agent.model,
      personality: agent.personality,
    });

    if (result.error) return { error: result.error };

    store.updateGameState(gameId, result.state);
    const player = result.state.players.find((p) => p.agentId === agentId)!;
    store.addPlayerToGame(gameId, agentId, player.id);
    this.broadcastEvents(gameId, result.events);

    return { playerId: player.id, seatIndex: player.seatIndex };
  }

  // ─── Start game ─────────────────────────────────────────────────────────────

  startGame(gameId: string): { error?: string } {
    const record = store.getGame(gameId);
    if (!record) return { error: 'Game not found' };

    const result = applyAction(record.state, { type: 'GAME_START' });
    if (result.error) return { error: result.error };

    store.updateGameState(gameId, result.state);
    this.broadcastEvents(gameId, result.events);
    this.schedulePhaseTimer(gameId, result.state);

    return {};
  }

  // ─── Agent actions ──────────────────────────────────────────────────────────

  submitAction(
    gameId: string,
    agentId: string,
    action: EngineAction,
  ): { error?: string } {
    const record = store.getGame(gameId);
    if (!record) return { error: 'Game not found' };

    // Attach player ID for actions that need it
    const state = record.state;
    const playerId = record.agentMap[agentId];
    if (!playerId) return { error: 'Agent not in this game' };

    let enrichedAction = action;
    if (action.type === 'SEND_MESSAGE' || action.type === 'CAST_VOTE' || action.type === 'SUBMIT_NIGHT_ACTION') {
      if (action.type === 'SEND_MESSAGE') enrichedAction = { ...action, playerId };
      else if (action.type === 'CAST_VOTE') enrichedAction = { ...action, voterId: playerId };
      else if (action.type === 'SUBMIT_NIGHT_ACTION') enrichedAction = { ...action, playerId };
    }

    const result = applyAction(state, enrichedAction);
    if (result.error) return { error: result.error };

    store.updateGameState(gameId, result.state);
    this.broadcastEvents(gameId, result.events);

    // Auto-advance if all required actions submitted
    if (result.shouldAdvance) {
      this.advancePhase(gameId);
    }

    return {};
  }

  // ─── Phase advancement ──────────────────────────────────────────────────────

  advancePhase(gameId: string): void {
    const record = store.getGame(gameId);
    if (!record || record.state.status !== 'active') return;

    // Cancel existing timer
    const existing = this.phaseTimers.get(gameId);
    if (existing) {
      clearTimeout(existing);
      this.phaseTimers.delete(gameId);
    }

    // Apply defaults for any missing actions
    let state = this.applyDefaults(record.state);

    const result = applyAction(state, { type: 'ADVANCE_PHASE' });
    if (result.error) return;

    store.updateGameState(gameId, result.state);
    this.broadcastEvents(gameId, result.events);

    if (result.state.status !== 'finished') {
      this.schedulePhaseTimer(gameId, result.state);
    }
  }

  private applyDefaults(state: InternalGameState): InternalGameState {
    if (!config.autoDefaultActions) return state;

    let s = state;

    // Default votes: skip
    if (state.phase === 'voting') {
      for (const playerId of state.pendingVoters) {
        const r = applyAction(s, { type: 'CAST_VOTE', voterId: playerId, targetId: 'skip' });
        if (!r.error) s = r.state;
      }
    }

    // Default night actions: skip (pick random alive non-self target if needed)
    if (state.phase === 'night') {
      for (const playerId of state.pendingNightActors) {
        const r = applyAction(s, {
          type: 'SUBMIT_NIGHT_ACTION',
          playerId,
          targetId: null,
        });
        if (!r.error) s = r.state;
      }
    }

    return s;
  }

  private schedulePhaseTimer(gameId: string, state: InternalGameState): void {
    const remaining = Math.max(0, state.phaseDeadline - Date.now());
    if (remaining <= 0 || state.status === 'finished') return;

    const timer = setTimeout(() => {
      this.advancePhase(gameId);
    }, remaining + 200); // +200ms grace

    this.phaseTimers.set(gameId, timer);

    // Also schedule periodic timer broadcasts every 10s
    const broadcastTimer = (ms: number) => {
      if (ms <= 0) return;
      const t = setTimeout(() => {
        const rec = store.getGame(gameId);
        if (!rec || rec.state.status !== 'active') return;
        const rem = Math.max(0, rec.state.phaseDeadline - Date.now());
        wsManager.broadcastTimer(gameId, rec.state.phase, rem);
        if (rem > 10_000) broadcastTimer(10_000);
      }, Math.min(ms, 10_000));
    };
    broadcastTimer(remaining);
  }

  // ─── Views ──────────────────────────────────────────────────────────────────

  getGameView(gameId: string): GameView | null {
    const record = store.getGame(gameId);
    if (!record) return null;
    return buildGameView(record.state, null);
  }

  getAgentGameView(gameId: string, agentId: string): AgentGameView | null {
    const record = store.getGame(gameId);
    if (!record) return null;

    const playerId = record.agentMap[agentId];
    if (!playerId) return null;

    const player = record.state.players.find((p) => p.id === playerId);
    if (!player) return null;

    const base = buildGameView(record.state, playerId);
    const timeRemainingMs = Math.max(0, record.state.phaseDeadline - Date.now());

    const privateInfo: AgentGameView['yourPrivateInfo'] = {};
    if (player.role === 'mafia') {
      privateInfo.mafiaTeam = record.state.players
        .filter((p) => p.role === 'mafia' && p.id !== playerId)
        .map((p) => p.id);
    }
    if (player.role === 'detective') {
      privateInfo.inspectHistory = record.state.inspectionResults[playerId] ?? [];
    }
    if (player.role === 'doctor') {
      privateInfo.saveHistory = record.state.saveHistory[playerId] ?? [];
    }

    return {
      ...base,
      yourPlayerId: playerId,
      yourRole: player.role,
      yourPrivateInfo: privateInfo,
      timeRemainingMs,
      pendingNightActors: Array.from(record.state.pendingNightActors)
        .map((id) => record.state.players.find((p) => p.id === id)?.role ?? 'unknown')
        .filter((v, i, arr) => arr.indexOf(v) === i), // unique role names
    };
  }

  listGames(status?: 'waiting' | 'active' | 'finished'): GameSummary[] {
    return store.listGames(status).map((r) => buildGameSummary(r.state));
  }

  getReplay(gameId: string): ReplayData | null {
    const record = store.getGame(gameId);
    if (!record || record.state.status !== 'finished') return null;

    const view = buildGameView(record.state, null, true) as any;
    // Attach roles to all players for post-game reveal
    view.players = record.state.players.map((p) => buildPlayerView(p, null, true));

    return {
      game: view,
      events: record.state.events as any,
      reasoningLogs: record.state.reasoningLogs.map((log) => {
        const player = record.state.players.find((p) => p.id === log.playerId);
        return {
          ...log,
          gameId,
          playerName: player?.agentName ?? 'Unknown',
        };
      }),
    };
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private broadcastEvents(gameId: string, events: StoredEvent[]): void {
    for (const event of events) {
      if (event.isPublic) {
        wsManager.broadcastEvent(gameId, event as unknown as AnyGameEvent);
      }
    }
  }
}

// ─── View builders ───────────────────────────────────────────────────────────

function buildPlayerView(
  player: InternalGameState['players'][number],
  requestingPlayerId: string | null,
  revealRole = false,
): PlayerView {
  const showRole =
    revealRole ||
    (requestingPlayerId !== null && player.id === requestingPlayerId);

  return {
    id: player.id,
    agentId: player.agentId,
    agentName: player.agentName,
    isAlive: player.isAlive,
    seatIndex: player.seatIndex,
    model: player.model,
    personality: player.personality,
    role: showRole ? player.role : undefined,
  };
}

function buildGameView(
  state: InternalGameState,
  requestingPlayerId: string | null,
  revealAll = false,
): GameView {
  const recentMessages: ChatMessage[] = state.messages
    .filter((m) => {
      if (!m.isMafiaChannel) return true;
      if (revealAll) return true;
      // Show mafia channel only to mafia members
      const player = state.players.find((p) => p.id === requestingPlayerId);
      return player?.role === 'mafia';
    })
    .slice(-20)
    .map((m) => {
      const player = state.players.find((p) => p.id === m.playerId);
      return {
        id: m.id,
        playerId: m.playerId,
        playerName: player?.agentName ?? 'Unknown',
        content: m.content,
        phase: m.phase,
        day: m.day,
        timestamp: m.timestamp,
        isMafiaChannel: m.isMafiaChannel,
      };
    });

  const voteTally: Record<string, number> = {};
  for (const targetId of Object.values(state.votes)) {
    if (targetId !== 'skip') {
      voteTally[targetId] = (voteTally[targetId] ?? 0) + 1;
    }
  }

  return {
    id: state.id,
    status: state.status,
    phase: state.phase,
    day: state.day,
    players: state.players.map((p) => buildPlayerView(p, requestingPlayerId, revealAll)),
    recentMessages,
    voteTally,
    phaseDeadline: state.phaseDeadline,
    winner: state.winner ?? undefined,
    createdAt: state.phaseStartedAt,
    endedAt: state.status === 'finished' ? Date.now() : undefined,
  };
}

function buildGameSummary(state: InternalGameState): GameSummary {
  const alive = state.players.filter((p) => p.isAlive).length;
  return {
    id: state.id,
    status: state.status,
    phase: state.phase,
    day: state.day,
    playerCount: state.players.length,
    alivePlayers: alive,
    createdAt: state.phaseStartedAt,
    winner: state.winner ?? undefined,
  };
}

// Singleton
export const gameService = new GameService();

// Re-export the internal type for use in routes
export type { InternalGameState };
