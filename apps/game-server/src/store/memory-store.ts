import { v4 as uuidv4 } from 'uuid';
import type { InternalGameState } from '@mafia-ai/game-engine';

export interface AgentRecord {
  agentId: string;
  agentName: string;
  model: string;
  personality: string;
  apiKey: string;
  registeredAt: number;
}

export interface GameRecord {
  state: InternalGameState;
  agentMap: Record<string, string>; // agentId → playerId (for quick lookup)
  playerMap: Record<string, string>; // playerId → agentId
}

class MemoryStore {
  private agents = new Map<string, AgentRecord>();
  private apiKeyIndex = new Map<string, string>(); // apiKey → agentId
  private games = new Map<string, GameRecord>();
  private matchmakingQueue: string[] = []; // agentIds

  // ─── Agents ────────────────────────────────────────────────────────────────

  registerAgent(agentName: string, model: string, personality: string): AgentRecord {
    const agentId = uuidv4();
    const apiKey = uuidv4();
    const record: AgentRecord = {
      agentId,
      agentName,
      model,
      personality,
      apiKey,
      registeredAt: Date.now(),
    };
    this.agents.set(agentId, record);
    this.apiKeyIndex.set(apiKey, agentId);
    return record;
  }

  getAgent(agentId: string): AgentRecord | undefined {
    return this.agents.get(agentId);
  }

  getAgentByApiKey(apiKey: string): AgentRecord | undefined {
    const agentId = this.apiKeyIndex.get(apiKey);
    return agentId ? this.agents.get(agentId) : undefined;
  }

  listAgents(): AgentRecord[] {
    return Array.from(this.agents.values());
  }

  // ─── Games ─────────────────────────────────────────────────────────────────

  createGame(state: InternalGameState): GameRecord {
    const record: GameRecord = {
      state,
      agentMap: {},
      playerMap: {},
    };
    this.games.set(state.id, record);
    return record;
  }

  getGame(gameId: string): GameRecord | undefined {
    return this.games.get(gameId);
  }

  updateGame(gameId: string, updater: (record: GameRecord) => GameRecord): boolean {
    const existing = this.games.get(gameId);
    if (!existing) return false;
    this.games.set(gameId, updater(existing));
    return true;
  }

  updateGameState(gameId: string, newState: InternalGameState): boolean {
    return this.updateGame(gameId, (r) => ({ ...r, state: newState }));
  }

  addPlayerToGame(gameId: string, agentId: string, playerId: string): void {
    this.updateGame(gameId, (r) => ({
      ...r,
      agentMap: { ...r.agentMap, [agentId]: playerId },
      playerMap: { ...r.playerMap, [playerId]: agentId },
    }));
  }

  listGames(status?: 'waiting' | 'active' | 'finished'): GameRecord[] {
    const all = Array.from(this.games.values());
    if (!status) return all;
    return all.filter((g) => g.state.status === status);
  }

  // ─── Matchmaking Queue ─────────────────────────────────────────────────────

  enqueue(agentId: string): void {
    if (!this.matchmakingQueue.includes(agentId)) {
      this.matchmakingQueue.push(agentId);
    }
  }

  dequeue(count: number): string[] {
    const taken = this.matchmakingQueue.splice(0, count);
    return taken;
  }

  getQueueLength(): number {
    return this.matchmakingQueue.length;
  }

  getQueue(): string[] {
    return [...this.matchmakingQueue];
  }

  removeFromQueue(agentId: string): void {
    this.matchmakingQueue = this.matchmakingQueue.filter((id) => id !== agentId);
  }
}

// Singleton
export const store = new MemoryStore();
