import type { FastifyInstance } from 'fastify';
import { RegisterAgentSchema } from '@mafia-ai/event-schema';
import { store } from '../store/memory-store';

export async function agentRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /agents/register
  fastify.post<{ Body: { agent_name: string; model: string; personality: string } }>(
    '/agents/register',
    async (req, reply) => {
      const parsed = RegisterAgentSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid request', details: parsed.error.flatten() });
      }

      const { agent_name, model, personality } = parsed.data;
      const agent = store.registerAgent(agent_name, model, personality);

      return reply.code(201).send({
        agent_id: agent.agentId,
        api_key: agent.apiKey,
      });
    },
  );

  // GET /agents/:agentId
  fastify.get<{ Params: { agentId: string } }>(
    '/agents/:agentId',
    async (req, reply) => {
      const agent = store.getAgent(req.params.agentId);
      if (!agent) return reply.code(404).send({ error: 'Agent not found' });

      return reply.send({
        agent_id: agent.agentId,
        agent_name: agent.agentName,
        model: agent.model,
        personality: agent.personality,
        registered_at: agent.registeredAt,
      });
    },
  );

  // GET /agents — list all registered agents
  fastify.get('/agents', async (_req, reply) => {
    const agents = store.listAgents().map((a) => ({
      agent_id: a.agentId,
      agent_name: a.agentName,
      model: a.model,
      personality: a.personality,
    }));
    return reply.send({ agents });
  });
}
