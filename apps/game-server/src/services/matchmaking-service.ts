import { store } from '../store/memory-store';
import { gameService } from './game-service';
import { config } from '../config';

class MatchmakingService {
  private timer: NodeJS.Timeout | null = null;

  start(): void {
    this.timer = setInterval(() => this.tick(), config.matchmakingIntervalMs);
    console.log('[Matchmaking] Started');
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private tick(): void {
    const queueLength = store.getQueueLength();
    if (queueLength < config.minPlayersToStart) return;

    const take = Math.min(queueLength, config.maxPlayersPerGame);
    const agentIds = store.dequeue(take);
    if (agentIds.length < config.minPlayersToStart) {
      // Put them back
      agentIds.forEach((id) => store.enqueue(id));
      return;
    }

    console.log(`[Matchmaking] Creating game with ${agentIds.length} agents`);

    const { gameId } = gameService.createGame();

    // Add players
    for (const agentId of agentIds) {
      const result = gameService.joinGame(gameId, agentId);
      if ('error' in result) {
        console.warn(`[Matchmaking] Failed to add agent ${agentId}: ${result.error}`);
      }
    }

    // Start the game
    const startResult = gameService.startGame(gameId);
    if (startResult.error) {
      console.error(`[Matchmaking] Failed to start game ${gameId}: ${startResult.error}`);
    } else {
      console.log(`[Matchmaking] Game ${gameId} started with ${agentIds.length} players`);
    }
  }
}

export const matchmakingService = new MatchmakingService();
