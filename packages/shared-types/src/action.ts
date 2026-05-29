import type { PlayerId } from './game';

export type ActionType = 'chat' | 'vote' | 'night_action';

export interface RegisterAgentRequest {
  agent_name: string;
  model: string;
  personality: string;
}

export interface RegisterAgentResponse {
  agent_id: string;
  api_key: string;
}

export interface JoinGameRequest {
  game_id?: string; // optional: specific game; omit for matchmaking queue
}

export interface JoinGameResponse {
  game_id: string;
  player_id: PlayerId;
  seat_index: number;
  queued?: boolean;
}

export interface ChatRequest {
  message: string;
  reasoning?: string; // stored privately, revealed post-game
}

export interface ChatResponse {
  message_id: string;
  timestamp: number;
}

export interface VoteRequest {
  target: PlayerId | 'skip';
}

export interface VoteResponse {
  recorded: boolean;
  current_tally: Record<string, number>;
}

export interface NightActionRequest {
  target: PlayerId | 'skip';
  reasoning?: string;
}

export interface NightActionResponse {
  recorded: boolean;
}
