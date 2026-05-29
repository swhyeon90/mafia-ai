import type {
  PlayerId,
  GameId,
  AgentId,
  Role,
  Team,
  GameStatus,
  GameConfig,
} from '@mafia-ai/shared-types';

export type { PlayerId, GameId, AgentId, Role, Team, GameStatus, GameConfig };

export type Phase =
  | 'lobby'
  | 'role-assignment'
  | 'discussion'
  | 'voting'
  | 'night'
  | 'finished';

export interface InternalPlayer {
  id: PlayerId;
  agentId: AgentId;
  agentName: string;
  role: Role;
  isAlive: boolean;
  seatIndex: number;
  model: string;
  personality: string;
}

export interface InternalMessage {
  id: string;
  playerId: PlayerId;
  content: string;
  timestamp: number;
  phase: Phase;
  day: number;
  isMafiaChannel: boolean;
}

export interface InternalReasoningLog {
  id: string;
  playerId: PlayerId;
  day: number;
  phase: Phase;
  reasoning: string;
  timestamp: number;
}

export interface NightAction {
  playerId: PlayerId;
  actionType: 'kill' | 'inspect' | 'save' | 'skip';
  targetId: PlayerId | null;
}

export interface InspectionResult {
  day: number;
  targetId: PlayerId;
  role: Role;
}

export interface SaveRecord {
  day: number;
  targetId: PlayerId;
}

export interface InternalGameState {
  id: GameId;
  status: GameStatus;
  phase: Phase;
  day: number;
  players: InternalPlayer[];
  votes: Record<PlayerId, PlayerId | 'skip'>; // voterId → targetId
  nightActions: Record<PlayerId, NightAction>; // playerId → action
  messages: InternalMessage[];
  reasoningLogs: InternalReasoningLog[];
  events: StoredEvent[];
  winner: Team | null;
  phaseStartedAt: number;
  phaseDeadline: number;
  config: GameConfig;
  // Private tracking
  inspectionResults: Record<PlayerId, InspectionResult[]>; // detectiveId → results
  saveHistory: Record<PlayerId, SaveRecord[]>; // doctorId → saves
  // Phase completion tracking
  pendingVoters: Set<PlayerId>; // alive players who haven't voted yet
  pendingNightActors: Set<PlayerId>; // players with abilities who haven't acted yet
}

export interface StoredEvent {
  id: string;
  type: string;
  payload: unknown;
  timestamp: number;
  isPublic: boolean;
}

// Actions the engine processes
export type EngineAction =
  | { type: 'PLAYER_JOIN'; agentId: AgentId; agentName: string; model: string; personality: string }
  | { type: 'GAME_START' }
  | { type: 'ADVANCE_PHASE' }
  | { type: 'SEND_MESSAGE'; playerId: PlayerId; content: string; reasoning?: string }
  | { type: 'CAST_VOTE'; voterId: PlayerId; targetId: PlayerId | 'skip' }
  | { type: 'SUBMIT_NIGHT_ACTION'; playerId: PlayerId; targetId: PlayerId | null; reasoning?: string };

export interface EngineResult {
  state: InternalGameState;
  events: StoredEvent[];
  error?: string;
  /** true when phase should auto-advance (e.g. all players acted) */
  shouldAdvance?: boolean;
}
