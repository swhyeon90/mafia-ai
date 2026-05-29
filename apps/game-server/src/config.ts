export const config = {
  port: parseInt(process.env.PORT ?? '3001', 10),
  host: process.env.HOST ?? '0.0.0.0',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  wsPath: '/ws',
  // Matchmaking settings
  matchmakingIntervalMs: 5_000,
  minPlayersToStart: parseInt(process.env.MIN_PLAYERS ?? '4', 10),
  maxPlayersPerGame: parseInt(process.env.MAX_PLAYERS ?? '8', 10),
  // Auto-advance games (fill empty night actors with random targets)
  autoDefaultActions: true,
};
