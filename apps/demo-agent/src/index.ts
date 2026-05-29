import 'dotenv/config';
import { AgentClient } from './agent-client';
import { AgentLoop } from './agent-loop';
import { AnthropicLLM } from './llm/anthropic-llm';
import { OpenAILLM } from './llm/openai-llm';
import { agentConfig, GEMINI_BASE_URL, PERSONALITIES, AGENT_NAMES } from './config';

type Provider = 'claude' | 'gpt' | 'gemini';

interface ProviderSpec {
  provider: Provider;
  count: number;
  model: string;
  makeLLM: () => InstanceType<typeof AnthropicLLM> | InstanceType<typeof OpenAILLM>;
}

async function main() {
  const specs: ProviderSpec[] = [
    {
      provider: 'claude',
      count: agentConfig.claudeAgentCount,
      model: agentConfig.claudeModel,
      makeLLM: () => new AnthropicLLM(agentConfig.anthropicApiKey, agentConfig.claudeModel),
    },
    {
      provider: 'gpt',
      count: agentConfig.gptAgentCount,
      model: agentConfig.gptModel,
      makeLLM: () => new OpenAILLM(agentConfig.openaiApiKey, agentConfig.gptModel),
    },
    {
      provider: 'gemini',
      count: agentConfig.geminiAgentCount,
      model: agentConfig.geminiModel,
      makeLLM: () => new OpenAILLM(agentConfig.geminiApiKey, agentConfig.geminiModel, GEMINI_BASE_URL),
    },
  ];

  // Validate which providers are configured
  const activeSpecs = specs.filter(({ provider, count }) => {
    if (count <= 0) return false;
    const key = provider === 'claude' ? agentConfig.anthropicApiKey
              : provider === 'gpt'    ? agentConfig.openaiApiKey
              :                         agentConfig.geminiApiKey;
    if (!key) {
      console.warn(`[Demo Agent] Skipping ${provider} agents — API key not set`);
      return false;
    }
    return true;
  });

  if (activeSpecs.length === 0) {
    console.error('[Demo Agent] No providers configured. Set at least one of: ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY');
    process.exit(1);
  }

  const totalAgents = activeSpecs.reduce((s, sp) => s + sp.count, 0);
  console.log(`\n🤖 Mafia AI Demo Agent`);
  console.log(`   Game Server: ${agentConfig.gameServerUrl}`);
  for (const sp of activeSpecs) {
    console.log(`   ${sp.provider.padEnd(8)} → ${sp.count} agents (${sp.model})`);
  }
  console.log(`   Total: ${totalAgents} agents\n`);

  const loops: AgentLoop[] = [];
  let delay = 0;

  for (const spec of activeSpecs) {
    const names = AGENT_NAMES[spec.provider];
    for (let i = 0; i < spec.count; i++) {
      await sleep(delay);
      delay = 500; // stagger subsequent registrations

      const name = names[i % names.length]!;
      const personality = PERSONALITIES[loops.length % PERSONALITIES.length]!;

      try {
        const client = await AgentClient.register(name, spec.model, personality);
        const loop = new AgentLoop(client, personality, spec.makeLLM());
        loops.push(loop);

        loop.start().catch((err) => {
          console.error(`[${name}] Agent loop error:`, err);
        });
      } catch (err) {
        console.error(`Failed to register agent ${name}:`, err);
      }
    }
  }

  console.log(`\n[Demo Agent] All agents started. Press Ctrl+C to stop.\n`);

  process.on('SIGINT', () => {
    console.log('\n[Demo Agent] Stopping...');
    loops.forEach((l) => l.stop());
    process.exit(0);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch(console.error);
