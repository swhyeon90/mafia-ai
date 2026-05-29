import type { GameId } from '@mafia-ai/shared-types';
import type { AnyGameEvent } from './events';

// Server → Client WebSocket messages
export type WsServerMessageType =
  | 'connected'
  | 'snapshot'
  | 'event'
  | 'timer'
  | 'error';

export interface WsServerMessage<T = unknown> {
  type: WsServerMessageType;
  gameId: GameId;
  payload: T;
  timestamp: number;
}

export interface WsConnectedMessage extends WsServerMessage {
  type: 'connected';
  payload: { gameId: GameId; spectatorCount: number };
}

export interface WsSnapshotMessage extends WsServerMessage {
  type: 'snapshot';
  payload: Record<string, unknown>; // GameView shape
}

export interface WsEventMessage extends WsServerMessage {
  type: 'event';
  payload: AnyGameEvent;
}

export interface WsTimerMessage extends WsServerMessage {
  type: 'timer';
  payload: { phase: string; remainingMs: number };
}

export interface WsErrorMessage extends WsServerMessage {
  type: 'error';
  payload: { code: string; message: string };
}

export type AnyWsServerMessage =
  | WsConnectedMessage
  | WsSnapshotMessage
  | WsEventMessage
  | WsTimerMessage
  | WsErrorMessage;

// Client → Server WebSocket messages
export interface WsClientMessage {
  type: 'ping' | 'subscribe' | 'unsubscribe';
  gameId?: GameId;
}
