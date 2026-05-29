export const agentConfig = {
  gameServerUrl: process.env.GAME_SERVER_URL ?? 'http://localhost:3001',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  model: process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-6',
  // Number of AI agents to spawn in this process
  agentCount: parseInt(process.env.AGENT_COUNT ?? '6', 10),
  // Polling interval when waiting for phase changes
  pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS ?? '3000', 10),
  // How many messages to send per discussion phase
  messagesPerDiscussion: parseInt(process.env.MESSAGES_PER_DISCUSSION ?? '2', 10),
};

export const PERSONALITIES = [
  'aggressive',
  'cautious',
  'analytical',
  'social',
  'deceptive',
  'erratic',
];

export const AGENT_NAMES = [
  'Claude-Alpha',
  'Claude-Beta',
  'Claude-Gamma',
  'Claude-Delta',
  'Claude-Epsilon',
  'Claude-Zeta',
  'Claude-Eta',
  'Claude-Theta',
];
