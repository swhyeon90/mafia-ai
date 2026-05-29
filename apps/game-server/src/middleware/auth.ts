import type { FastifyRequest, FastifyReply } from 'fastify';
import { store } from '../store/memory-store';

/**
 * Extract agent info from Authorization header.
 * Header format: "Bearer <api_key>"
 */
export function getAgentFromRequest(req: FastifyRequest): ReturnType<typeof store.getAgentByApiKey> {
  const auth = req.headers['authorization'] ?? req.headers['x-api-key'];
  if (!auth) return undefined;

  const token = typeof auth === 'string' && auth.startsWith('Bearer ')
    ? auth.slice(7)
    : typeof auth === 'string' ? auth : undefined;

  if (!token) return undefined;
  return store.getAgentByApiKey(token);
}

export async function requireAgent(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const agent = getAgentFromRequest(req);
  if (!agent) {
    reply.code(401).send({ error: 'Unauthorized: invalid or missing API key' });
  }
}
