import type { GameId, PlayerId, Role, Team, ChatMessage } from '@mafia-ai/shared-types';
import type { Phase } from '@mafia-ai/shared-types';

// All possible game event types
export type GameEventType =
  | 'GAME_CREATED'
  | 'PLAYER_JOINED'
  | 'GAME_STARTED'
  | 'PHASE_STARTED'
  | 'MESSAGE_SENT'
  | 'VOTE_CAST'
  | 'VOTES_RESOLVED'
  | 'NIGHT_ACTION_SUBMITTED'
  | 'NIGHT_RESOLVED'
  | 'PLAYER_ELIMINATED'
  | 'GAME_FINISHED'
  | 'ROLES_REVEALED';

// Base event envelope
export interface BaseGameEvent {
  id: string;
  gameId: GameId;
  timestamp: number;
  isPublic: boolean; // false = hidden until game ends
}

// Discriminated union of all event payloads
export interface GameCreatedEvent extends BaseGameEvent {
  type: 'GAME_CREATED';
  payload: { config: Record<string, unknown> };
}

export interface PlayerJoinedEvent extends BaseGameEvent {
  type: 'PLAYER_JOINED';
  payload: {
    playerId: PlayerId;
    agentName: string;
    model: string;
    personality: string;
    seatIndex: number;
  };
}

export interface GameStartedEvent extends BaseGameEvent {
  type: 'GAME_STARTED';
  payload: { playerCount: number };
}

export interface PhaseStartedEvent extends BaseGameEvent {
  type: 'PHASE_STARTED';
  payload: { phase: Phase; day: number; timeoutMs: number };
}

export interface MessageSentEvent extends BaseGameEvent {
  type: 'MESSAGE_SENT';
  payload: { message: ChatMessage };
}

export interface VoteCastEvent extends BaseGameEvent {
  type: 'VOTE_CAST';
  payload: { voterId: PlayerId; voterName: string; targetId: PlayerId | 'skip' };
}

export interface VotesResolvedEvent extends BaseGameEvent {
  type: 'VOTES_RESOLVED';
  payload: {
    eliminated: PlayerId | null;
    eliminatedName: string | null;
    eliminatedRole: Role | null;
    tally: Record<PlayerId, number>;
  };
}

export interface NightActionSubmittedEvent extends BaseGameEvent {
  type: 'NIGHT_ACTION_SUBMITTED';
  payload: { role: Role }; // intentionally vague to keep hidden
}

export interface NightResolvedEvent extends BaseGameEvent {
  type: 'NIGHT_RESOLVED';
  payload: {
    killed: PlayerId | null;
    killedName: string | null;
    killedRole: Role | null;
    saved: boolean;
  };
}

export interface PlayerEliminatedEvent extends BaseGameEvent {
  type: 'PLAYER_ELIMINATED';
  payload: {
    playerId: PlayerId;
    playerName: string;
    role: Role;
    method: 'vote' | 'night-kill';
    day: number;
  };
}

export interface GameFinishedEvent extends BaseGameEvent {
  type: 'GAME_FINISHED';
  payload: {
    winner: Team;
    day: number;
    survivingPlayers: PlayerId[];
  };
}

export interface RolesRevealedEvent extends BaseGameEvent {
  type: 'ROLES_REVEALED';
  payload: { roles: Record<PlayerId, Role> };
}

export type AnyGameEvent =
  | GameCreatedEvent
  | PlayerJoinedEvent
  | GameStartedEvent
  | PhaseStartedEvent
  | MessageSentEvent
  | VoteCastEvent
  | VotesResolvedEvent
  | NightActionSubmittedEvent
  | NightResolvedEvent
  | PlayerEliminatedEvent
  | GameFinishedEvent
  | RolesRevealedEvent;
