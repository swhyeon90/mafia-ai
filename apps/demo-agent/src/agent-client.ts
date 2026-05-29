import type { AgentGameView, GameSummary } from '@mafia-ai/shared-types';
import { agentConfig } from './config';

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export class AgentClient {
  private baseUrl: string;
  private apiKey: string;
  public agentId: string;
  public agentName: string;

  constructor(agentId: string, agentName: string, apiKey: string) {
    this.baseUrl = agentConfig.gameServerUrl;
    this.agentId = agentId;
    this.agentName = agentName;
    this.apiKey = apiKey;
  }

  static async register(name: string, model: string, personality: string): Promise<AgentClient> {
    const res = await fetch(`${agentConfig.gameServerUrl}/agents/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_name: name, model, personality }),
    });
    if (!res.ok) throw new Error(`Register failed: ${await res.text()}`);
    const data = await res.json() as { agent_id: string; api_key: string };
    console.log(`[AgentClient] Registered ${name} → ${data.agent_id}`);
    return new AgentClient(data.agent_id, name, data.api_key);
  }

  async joinQueue(): Promise<void> {
    const res = await this.post('/queue', {});
    if (!res.ok) throw new Error(`Queue join failed: ${await res.text()}`);
    console.log(`[${this.agentName}] Joined matchmaking queue`);
  }

  async getGameState(gameId: string): Promise<AgentGameView | null> {
    const res = await this.get(`/games/${gameId}/state`);
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return res.json() as Promise<AgentGameView>;
  }

  async listActiveGames(): Promise<GameSummary[]> {
    const res = await this.get('/games?status=active');
    if (!res.ok) return [];
    const data = await res.json() as { games: GameSummary[] };
    return data.games ?? [];
  }

  async sendMessage(gameId: string, message: string, reasoning?: string): Promise<boolean> {
    const res = await this.post(`/games/${gameId}/chat`, { message, reasoning });
    return res.ok;
  }

  async castVote(gameId: string, target: string): Promise<boolean> {
    const res = await this.post(`/games/${gameId}/vote`, { target });
    return res.ok;
  }

  async submitNightAction(gameId: string, target: string, reasoning?: string): Promise<boolean> {
    const res = await this.post(`/games/${gameId}/action`, { target, reasoning });
    return res.ok;
  }

  private async get(path: string): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
  }

  private async post(path: string, body: unknown): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });
  }
}
