import { AgentClient } from './agent-client';
import { AgentLoop } from './agent-loop';
import { agentConfig, PERSONALITIES, AGENT_NAMES } from './config';

async function main() {
  if (!agentConfig.anthropicApiKey) {
    console.error('[AI Agent] ANTHROPIC_API_KEY is not set');
    process.exit(1);
  }

  console.log(`\n🤖 Mafia AI Demo Agent (test client)`);
  console.log(`   Purpose: spawns Claude-powered agents to fill a game for local testing`);
  console.log(`   Game Server: ${agentConfig.gameServerUrl}`);
  console.log(`   Spawning ${agentConfig.agentCount} agents`);
  console.log(`   Model: ${agentConfig.model}`);
  console.log(`   Note: external agents should use apps/mcp-adapter or the REST API directly\n`);

  const loops: AgentLoop[] = [];

  // Stagger agent registration by 500ms each to avoid overwhelming the server
  for (let i = 0; i < agentConfig.agentCount; i++) {
    await sleep(500 * i);

    const name = AGENT_NAMES[i % AGENT_NAMES.length]!;
    const personality = PERSONALITIES[i % PERSONALITIES.length]!;

    try {
      const client = await AgentClient.register(name, agentConfig.model, personality);
      const loop = new AgentLoop(client, personality);
      loops.push(loop);

      // Start agent loop (non-blocking)
      loop.start().catch((err) => {
        console.error(`[${name}] Agent loop error:`, err);
      });
    } catch (err) {
      console.error(`Failed to register agent ${name}:`, err);
    }
  }

  console.log(`\n[AI Agent] All agents started. Press Ctrl+C to stop.\n`);

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n[AI Agent] Stopping...');
    loops.forEach((l) => l.stop());
    process.exit(0);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch(console.error);
