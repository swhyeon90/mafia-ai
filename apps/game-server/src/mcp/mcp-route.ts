import { randomUUID } from 'crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { store } from '../store/memory-store';
import { gameService } from '../services/game-service';

interface SessionState {
  transport: StreamableHTTPServerTransport;
  agentId?: string;
  apiKey?: string;
}

const sessions = new Map<string, SessionState>();

function createMcpServer(state: SessionState): McpServer {
  const server = new McpServer({ name: 'mafia-ai-game', version: '1.0.0' });

  function requireAuth() {
    if (!state.agentId || !state.apiKey) {
      throw new Error('Not authenticated. Call register_agent first.');
    }
    return state.agentId;
  }

  server.tool(
    'register_agent',
    'Register a new agent. Call this first — it returns your credentials and stores them in the session.',
    {
      agent_name: z.string().describe('Your agent name (e.g. "Claude-Strategist")'),
      model: z.string().describe('Model identifier (e.g. "claude-sonnet-4-6")'),
      personality: z.string().describe('Personality style (e.g. "aggressive", "cautious", "analytical")'),
    },
    async ({ agent_name, model, personality }) => {
      const agent = store.registerAgent(agent_name, model, personality);
      state.agentId = agent.agentId;
      state.apiKey = agent.apiKey;
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            agent_id: agent.agentId,
            api_key: agent.apiKey,
            message: 'Registered. Call join_queue to enter matchmaking.',
          }),
        }],
      };
    },
  );

  server.tool(
    'join_queue',
    'Join the matchmaking queue. A game starts automatically once 4+ agents are queued (checked every 5 seconds).',
    {},
    async () => {
      const agentId = requireAuth();
      store.enqueue(agentId);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            queued: true,
            queue_position: store.getQueue().indexOf(agentId) + 1,
            queue_length: store.getQueueLength(),
          }),
        }],
      };
    },
  );

  server.tool(
    'leave_queue',
    'Leave the matchmaking queue.',
    {},
    async () => {
      const agentId = requireAuth();
      store.removeFromQueue(agentId);
      return { content: [{ type: 'text', text: JSON.stringify({ queued: false }) }] };
    },
  );

  server.tool(
    'get_queue',
    'Get current matchmaking queue status (public).',
    {},
    async () => {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            queue_length: store.getQueueLength(),
            agents: store.getQueue(),
          }),
        }],
      };
    },
  );

  server.tool(
    'list_games',
    'List games, optionally filtered by status.',
    {
      status: z.enum(['active', 'waiting', 'finished']).optional().describe('Filter by game status'),
    },
    async ({ status }) => {
      const games = gameService.listGames(status);
      return {
        content: [{ type: 'text', text: JSON.stringify({ games, total: games.length }) }],
      };
    },
  );

  server.tool(
    'get_game_state',
    'Get current game state. Returns your private role and alive/dead status when authenticated.',
    {
      game_id: z.string().describe('The game ID to query'),
    },
    async ({ game_id }) => {
      const agentId = requireAuth();
      const view = gameService.getAgentGameView(game_id, agentId) ?? gameService.getGameView(game_id);
      if (!view) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Game not found' }) }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify(view) }] };
    },
  );

  server.tool(
    'send_message',
    'Send a discussion message during the discussion phase.',
    {
      game_id: z.string(),
      message: z.string().max(500).describe('Your public discussion message'),
      reasoning: z.string().optional().describe('Your private reasoning (revealed post-game)'),
    },
    async ({ game_id, message, reasoning }) => {
      const agentId = requireAuth();
      const result = gameService.submitAction(game_id, agentId, {
        type: 'SEND_MESSAGE',
        playerId: '',
        content: message,
        reasoning,
      });
      if (result.error) return { content: [{ type: 'text', text: JSON.stringify({ error: result.error }) }] };
      return { content: [{ type: 'text', text: JSON.stringify({ ok: true }) }] };
    },
  );

  server.tool(
    'cast_vote',
    'Cast an elimination vote during the voting phase.',
    {
      game_id: z.string(),
      target: z.string().describe('Player ID to vote for, or "skip" to abstain'),
    },
    async ({ game_id, target }) => {
      const agentId = requireAuth();
      const result = gameService.submitAction(game_id, agentId, {
        type: 'CAST_VOTE',
        voterId: '',
        targetId: target,
      });
      if (result.error) return { content: [{ type: 'text', text: JSON.stringify({ error: result.error }) }] };
      return { content: [{ type: 'text', text: JSON.stringify({ recorded: true }) }] };
    },
  );

  server.tool(
    'submit_night_action',
    'Submit your night action. Mafia: kill a target. Detective: investigate. Doctor: protect. Use "skip" to pass.',
    {
      game_id: z.string(),
      target: z.string().describe('Player ID to target, or "skip"'),
      reasoning: z.string().optional().describe('Private reasoning (revealed post-game)'),
    },
    async ({ game_id, target, reasoning }) => {
      const agentId = requireAuth();
      const result = gameService.submitAction(game_id, agentId, {
        type: 'SUBMIT_NIGHT_ACTION',
        playerId: '',
        targetId: target === 'skip' ? null : target,
        reasoning,
      });
      if (result.error) return { content: [{ type: 'text', text: JSON.stringify({ error: result.error }) }] };
      return { content: [{ type: 'text', text: JSON.stringify({ recorded: true }) }] };
    },
  );

  server.tool(
    'get_replay',
    'Get the full event replay of a finished game.',
    {
      game_id: z.string().describe('The finished game ID'),
    },
    async ({ game_id }) => {
      const replay = gameService.getReplay(game_id);
      if (!replay) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Replay not available (game not finished or not found)' }) }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify(replay) }] };
    },
  );

  return server;
}

async function handleMcpRequest(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  reply.raw.setHeader('Access-Control-Allow-Origin', '*');
  reply.raw.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  reply.raw.setHeader('Access-Control-Allow-Headers', 'Content-Type, Mcp-Session-Id, Authorization');

  if (req.method === 'OPTIONS') {
    reply.raw.writeHead(204);
    reply.raw.end();
    reply.hijack();
    return;
  }

  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (sessionId && sessions.has(sessionId)) {
    await sessions.get(sessionId)!.transport.handleRequest(req.raw, reply.raw, req.body);
  } else if (req.method === 'POST') {
    const state: Partial<SessionState> = {};

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sid) => {
        sessions.set(sid, state as SessionState);
        transport.onclose = () => sessions.delete(sid);
      },
    });

    state.transport = transport;

    const server = createMcpServer(state as SessionState);
    await server.connect(transport);
    await transport.handleRequest(req.raw, reply.raw, req.body);
  } else {
    reply.raw.writeHead(400, { 'Content-Type': 'application/json' });
    reply.raw.end(JSON.stringify({ error: 'Invalid request: POST required to initialize session' }));
  }

  reply.hijack();
}

export async function mcpRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/mcp', handleMcpRequest);
  fastify.get('/mcp', handleMcpRequest);
  fastify.delete('/mcp', handleMcpRequest);
  fastify.options('/mcp', handleMcpRequest);
}
