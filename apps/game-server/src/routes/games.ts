import type { FastifyInstance } from 'fastify';
import { gameService } from '../services/game-service';
import { store } from '../store/memory-store';
import { getAgentFromRequest } from '../middleware/auth';
import {
  ChatRequestSchema,
  VoteRequestSchema,
  NightActionRequestSchema,
  JoinGameRequestSchema,
} from '@mafia-ai/event-schema';

export async function gameRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /games — create a new game (admin / auto)
  fastify.post('/games', async (_req, reply) => {
    const { gameId } = gameService.createGame();
    return reply.code(201).send({ game_id: gameId, status: 'waiting' });
  });

  // GET /games — list games
  fastify.get<{ Querystring: { status?: string; limit?: string } }>(
    '/games',
    async (req, reply) => {
      const status = req.query.status as 'waiting' | 'active' | 'finished' | undefined;
      const limit = Math.min(parseInt(req.query.limit ?? '50', 10), 100);
      const games = gameService.listGames(status).slice(0, limit);
      return reply.send({ games, total: games.length });
    },
  );

  // GET /games/:gameId — get game summary (public)
  fastify.get<{ Params: { gameId: string } }>(
    '/games/:gameId',
    async (req, reply) => {
      const view = gameService.getGameView(req.params.gameId);
      if (!view) return reply.code(404).send({ error: 'Game not found' });
      return reply.send(view);
    },
  );

  // GET /games/:gameId/state — agent-specific state (authenticated)
  fastify.get<{ Params: { gameId: string } }>(
    '/games/:gameId/state',
    async (req, reply) => {
      const agent = getAgentFromRequest(req);
      if (!agent) return reply.code(401).send({ error: 'Unauthorized' });

      const view = gameService.getAgentGameView(req.params.gameId, agent.agentId);
      if (!view) {
        // Try public view if agent not in game
        const publicView = gameService.getGameView(req.params.gameId);
        if (!publicView) return reply.code(404).send({ error: 'Game not found' });
        return reply.send(publicView);
      }

      return reply.send(view);
    },
  );

  // GET /games/:gameId/replay — full replay data (post-game only)
  fastify.get<{ Params: { gameId: string } }>(
    '/games/:gameId/replay',
    async (req, reply) => {
      const replay = gameService.getReplay(req.params.gameId);
      if (!replay) {
        return reply.code(404).send({ error: 'Replay not available (game not finished or not found)' });
      }
      return reply.send(replay);
    },
  );

  // POST /games/:gameId/queue — join matchmaking or specific game (authenticated)
  fastify.post<{ Params: { gameId: string } }>(
    '/games/:gameId/queue',
    async (req, reply) => {
      const agent = getAgentFromRequest(req);
      if (!agent) return reply.code(401).send({ error: 'Unauthorized' });

      const result = gameService.joinGame(req.params.gameId, agent.agentId);
      if ('error' in result) {
        return reply.code(400).send({ error: result.error });
      }
      return reply.code(200).send({
        game_id: req.params.gameId,
        player_id: result.playerId,
        seat_index: result.seatIndex,
      });
    },
  );

  // POST /queue — join matchmaking queue (authenticated)
  fastify.post(
    '/queue',
    async (req, reply) => {
      const agent = getAgentFromRequest(req);
      if (!agent) return reply.code(401).send({ error: 'Unauthorized' });

      store.enqueue(agent.agentId);
      return reply.send({
        queued: true,
        agent_id: agent.agentId,
        queue_position: store.getQueue().indexOf(agent.agentId) + 1,
        queue_length: store.getQueueLength(),
      });
    },
  );

  // DELETE /queue — leave matchmaking queue
  fastify.delete(
    '/queue',
    async (req, reply) => {
      const agent = getAgentFromRequest(req);
      if (!agent) return reply.code(401).send({ error: 'Unauthorized' });

      store.removeFromQueue(agent.agentId);
      return reply.send({ queued: false });
    },
  );

  // GET /queue — queue status
  fastify.get('/queue', async (_req, reply) => {
    return reply.send({
      queue_length: store.getQueueLength(),
      agents: store.getQueue(),
    });
  });

  // POST /games/:gameId/chat — send a message (authenticated)
  fastify.post<{ Params: { gameId: string }; Body: unknown }>(
    '/games/:gameId/chat',
    async (req, reply) => {
      const agent = getAgentFromRequest(req);
      if (!agent) return reply.code(401).send({ error: 'Unauthorized' });

      const parsed = ChatRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid request', details: parsed.error.flatten() });
      }

      const result = gameService.submitAction(req.params.gameId, agent.agentId, {
        type: 'SEND_MESSAGE',
        playerId: '', // will be resolved in service
        content: parsed.data.message,
        reasoning: parsed.data.reasoning,
      });

      if (result.error) return reply.code(400).send({ error: result.error });
      return reply.send({ ok: true });
    },
  );

  // POST /games/:gameId/vote — cast a vote (authenticated)
  fastify.post<{ Params: { gameId: string }; Body: unknown }>(
    '/games/:gameId/vote',
    async (req, reply) => {
      const agent = getAgentFromRequest(req);
      if (!agent) return reply.code(401).send({ error: 'Unauthorized' });

      const parsed = VoteRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid request', details: parsed.error.flatten() });
      }

      const result = gameService.submitAction(req.params.gameId, agent.agentId, {
        type: 'CAST_VOTE',
        voterId: '', // resolved in service
        targetId: parsed.data.target,
      });

      if (result.error) return reply.code(400).send({ error: result.error });

      const record = store.getGame(req.params.gameId);
      const voteTally: Record<string, number> = {};
      if (record) {
        for (const targetId of Object.values(record.state.votes)) {
          if (targetId !== 'skip') voteTally[targetId] = (voteTally[targetId] ?? 0) + 1;
        }
      }

      return reply.send({ recorded: true, current_tally: voteTally });
    },
  );

  // POST /games/:gameId/action — night action (authenticated)
  fastify.post<{ Params: { gameId: string }; Body: unknown }>(
    '/games/:gameId/action',
    async (req, reply) => {
      const agent = getAgentFromRequest(req);
      if (!agent) return reply.code(401).send({ error: 'Unauthorized' });

      const parsed = NightActionRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid request', details: parsed.error.flatten() });
      }

      const result = gameService.submitAction(req.params.gameId, agent.agentId, {
        type: 'SUBMIT_NIGHT_ACTION',
        playerId: '', // resolved in service
        targetId: parsed.data.target === 'skip' ? null : parsed.data.target,
        reasoning: parsed.data.reasoning,
      });

      if (result.error) return reply.code(400).send({ error: result.error });
      return reply.send({ recorded: true });
    },
  );
}
