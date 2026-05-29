export type PlayerId = string;
export type GameId = string;
export type AgentId = string;

export type Role = 'citizen' | 'mafia' | 'detective' | 'doctor';

export type Team = 'mafia' | 'citizens';

export type GameStatus = 'waiting' | 'active' | 'finished';

export interface GameConfig {
  minPlayers: number;
  maxPlayers: number;
  discussionTimeoutMs: number;
  votingTimeoutMs: number;
  nightTimeoutMs: number;
  roleAssignmentTimeoutMs: number;
}

export const DEFAULT_GAME_CONFIG: GameConfig = {
  minPlayers: 4,
  maxPlayers: 8,
  discussionTimeoutMs: 120_000,
  votingTimeoutMs: 60_000,
  nightTimeoutMs: 45_000,
  roleAssignmentTimeoutMs: 5_000,
};

export interface PlayerView {
  id: PlayerId;
  agentId: AgentId;
  agentName: string;
  isAlive: boolean;
  seatIndex: number;
  model: string;
  personality: string;
  role?: Role; // only present post-game or to the owning agent
}

export interface ChatMessage {
  id: string;
  playerId: PlayerId;
  playerName: string;
  content: string;
  phase: string;
  day: number;
  timestamp: number;
  isMafiaChannel: boolean;
}

export interface VoteTally {
  [targetId: string]: number;
}

export interface GameSummary {
  id: GameId;
  status: GameStatus;
  phase: string;
  day: number;
  playerCount: number;
  alivePlayers: number;
  createdAt: number;
  endedAt?: number;
  winner?: Team;
}

export interface GameView {
  id: GameId;
  status: GameStatus;
  phase: string;
  day: number;
  players: PlayerView[];
  recentMessages: ChatMessage[];
  voteTally: VoteTally;
  phaseDeadline: number;
  winner?: Team;
  createdAt: number;
  endedAt?: number;
}

export interface AgentGameView extends GameView {
  yourPlayerId: PlayerId;
  yourRole: Role;
  yourPrivateInfo: AgentPrivateInfo;
  timeRemainingMs: number;
  pendingNightActors: string[]; // names of roles still needing to act (e.g. "mafia", "detective")
}

export interface AgentPrivateInfo {
  mafiaTeam?: PlayerId[]; // for mafia role
  inspectHistory?: Array<{ day: number; targetId: PlayerId; role: Role }>; // for detective
  saveHistory?: Array<{ day: number; targetId: PlayerId }>; // for doctor
}

export interface ReasoningLog {
  id: string;
  gameId: GameId;
  playerId: PlayerId;
  playerName: string;
  day: number;
  phase: string;
  reasoning: string;
  timestamp: number;
}

export interface ReplayData {
  game: GameView & { players: (PlayerView & { role: Role })[] };
  events: GameEvent[];
  reasoningLogs: ReasoningLog[];
}

export interface GameEvent {
  id: string;
  gameId: GameId;
  type: string;
  payload: Record<string, unknown>;
  timestamp: number;
  isPublic: boolean;
}
