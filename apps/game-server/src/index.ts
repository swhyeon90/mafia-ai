import { buildServer } from './server';
import { matchmakingService } from './services/matchmaking-service';
import { config } from './config';

async function main() {
  const server = await buildServer();

  try {
    await server.listen({ port: config.port, host: config.host });
    console.log(`\n🎮 Mafia AI Game Server`);
    console.log(`   HTTP: http://localhost:${config.port}`);
    console.log(`   WS:   ws://localhost:${config.port}${config.wsPath}?gameId=<id>`);
    console.log(`   Docs: http://localhost:${config.port}/health\n`);

    // Start matchmaking loop
    matchmakingService.start();

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n[Server] Shutting down...');
      matchmakingService.stop();
      await server.close();
      process.exit(0);
    });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

main();
