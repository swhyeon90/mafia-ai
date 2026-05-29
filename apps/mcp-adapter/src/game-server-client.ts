const BASE_URL = process.env.GAME_SERVER_URL ?? 'http://localhost:3001';

export class GameServerClient {
  private apiKey: string | null = null;
  private agentId: string | null = null;

  setCredentials(agentId: string, apiKey: string): void {
    this.agentId = agentId;
    this.apiKey = apiKey;
  }

  async registerAgent(
    agentName: string,
    model: string,
    personality: string,
  ): Promise<{ agent_id: string; api_key: string }> {
    const res = await this.request('POST', '/agents/register', {
      agent_name: agentName,
      model,
      personality,
    });
    const data = await res.json() as { agent_id: string; api_key: string };
    this.agentId = data.agent_id;
    this.apiKey = data.api_key;
    return data;
  }

  async joinQueue(): Promise<unknown> {
    return this.authRequest('POST', '/queue', {});
  }

  async listGames(status?: string): Promise<unknown> {
    const qs = status ? `?status=${status}` : '';
    return this.authRequest('GET', `/games${qs}`);
  }

  async getGameState(gameId: string): Promise<unknown> {
    return this.authRequest('GET', `/games/${gameId}/state`);
  }

  async sendMessage(gameId: string, message: string, reasoning?: string): Promise<unknown> {
    return this.authRequest('POST', `/games/${gameId}/chat`, { message, reasoning });
  }

  async castVote(gameId: string, target: string): Promise<unknown> {
    return this.authRequest('POST', `/games/${gameId}/vote`, { target });
  }

  async submitNightAction(
    gameId: string,
    target: string,
    reasoning?: string,
  ): Promise<unknown> {
    return this.authRequest('POST', `/games/${gameId}/action`, { target, reasoning });
  }

  async getReplay(gameId: string): Promise<unknown> {
    return this.authRequest('GET', `/games/${gameId}/replay`);
  }

  private async authRequest(method: string, path: string, body?: unknown): Promise<unknown> {
    if (!this.apiKey) throw new Error('Not registered. Call register_agent first.');
    const res = await this.request(method, path, body, {
      Authorization: `Bearer ${this.apiKey}`,
    });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  private async request(
    method: string,
    path: string,
    body?: unknown,
    extraHeaders: Record<string, string> = {},
  ): Promise<Response> {
    return fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...extraHeaders,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }
}
