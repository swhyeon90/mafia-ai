import WebSocket from 'ws';
import type { AnyGameEvent } from '@mafia-ai/event-schema';
import type { GameView } from '@mafia-ai/shared-types';

type WsClient = WebSocket;

class WsManager {
  /** gameId → set of connected spectator WebSocket clients */
  private rooms = new Map<string, Set<WsClient>>();

  join(gameId: string, ws: WsClient): void {
    if (!this.rooms.has(gameId)) this.rooms.set(gameId, new Set());
    this.rooms.get(gameId)!.add(ws);

    ws.on('close', () => this.leave(gameId, ws));
    ws.on('error', () => this.leave(gameId, ws));
  }

  leave(gameId: string, ws: WsClient): void {
    const room = this.rooms.get(gameId);
    if (room) {
      room.delete(ws);
      if (room.size === 0) this.rooms.delete(gameId);
    }
  }

  /** Broadcast a serialised event to all spectators of a game */
  broadcastEvent(gameId: string, event: AnyGameEvent): void {
    this.broadcast(gameId, {
      type: 'event',
      gameId,
      payload: event,
      timestamp: Date.now(),
    });
  }

  /** Send initial snapshot to a single new spectator */
  sendSnapshot(ws: WsClient, gameId: string, view: GameView): void {
    this.send(ws, {
      type: 'snapshot',
      gameId,
      payload: view,
      timestamp: Date.now(),
    });
  }

  broadcastTimer(gameId: string, phase: string, remainingMs: number): void {
    this.broadcast(gameId, {
      type: 'timer',
      gameId,
      payload: { phase, remainingMs },
      timestamp: Date.now(),
    });
  }

  getSpectatorCount(gameId: string): number {
    return this.rooms.get(gameId)?.size ?? 0;
  }

  private broadcast(gameId: string, message: unknown): void {
    const room = this.rooms.get(gameId);
    if (!room) return;
    const payload = JSON.stringify(message);
    for (const ws of room) {
      if (ws.readyState === WebSocket.OPEN) ws.send(payload);
    }
  }

  private send(ws: WsClient, message: unknown): void {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
  }
}

export const wsManager = new WsManager();
