import Fastify from 'fastify';
import cors from '@fastify/cors';
import { IncomingMessage, Server, ServerResponse } from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { config } from './config';
import { agentRoutes } from './routes/agents';
import { gameRoutes } from './routes/games';
import { wsManager } from './ws/ws-manager';
import { gameService } from './services/game-service';

export async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      transport: {
        target: 'pino-pretty',
        options: { colorize: true },
      },
    },
  });

  // ─── CORS ───────────────────────────────────────────────────────────────────
  await fastify.register(cors, {
    origin: config.corsOrigin.split(','),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  // ─── Routes ─────────────────────────────────────────────────────────────────
  await fastify.register(agentRoutes);
  await fastify.register(gameRoutes);

  // Health check
  fastify.get('/health', async () => ({ ok: true, timestamp: Date.now() }));

  // ─── WebSocket (attached to the underlying http server) ─────────────────────
  const wss = new WebSocketServer({ noServer: true });

  fastify.server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url ?? '/', `http://${request.headers.host}`);
    if (url.pathname === config.wsPath) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (ws, request) => {
    const url = new URL(request.url ?? '/', `http://${request.headers.host}`);
    const gameId = url.searchParams.get('gameId');

    if (!gameId) {
      ws.close(1008, 'gameId required');
      return;
    }

    const view = gameService.getGameView(gameId);
    if (!view) {
      ws.close(1008, 'Game not found');
      return;
    }

    // Register and send snapshot
    wsManager.join(gameId, ws);
    wsManager.sendSnapshot(ws, gameId, view);

    // Send welcome
    ws.send(
      JSON.stringify({
        type: 'connected',
        gameId,
        payload: { gameId, spectatorCount: wsManager.getSpectatorCount(gameId) },
        timestamp: Date.now(),
      }),
    );

    // Handle client messages
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        }
      } catch {
        // ignore malformed messages
      }
    });
  });

  return fastify;
}
