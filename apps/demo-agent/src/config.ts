export const agentConfig = {
  gameServerUrl: process.env.GAME_SERVER_URL ?? 'http://localhost:3001',
  pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS ?? '3000', 10),
  messagesPerDiscussion: parseInt(process.env.MESSAGES_PER_DISCUSSION ?? '2', 10),

  // Anthropic / Claude
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  claudeModel: process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-6',
  claudeAgentCount: parseInt(process.env.CLAUDE_AGENT_COUNT ?? '2', 10),

  // OpenAI / ChatGPT
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',
  gptModel: process.env.GPT_MODEL ?? 'gpt-4o-mini',
  gptAgentCount: parseInt(process.env.GPT_AGENT_COUNT ?? '2', 10),

  // Google Gemini (via OpenAI-compatible endpoint)
  geminiApiKey: process.env.GEMINI_API_KEY ?? '',
  geminiModel: process.env.GEMINI_MODEL ?? 'gemini-1.5-flash',
  geminiAgentCount: parseInt(process.env.GEMINI_AGENT_COUNT ?? '2', 10),
};

export const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/';

export const PERSONALITIES = [
  'aggressive',
  'cautious',
  'analytical',
  'social',
  'deceptive',
  'erratic',
];

export const AGENT_NAMES: Record<'claude' | 'gpt' | 'gemini', string[]> = {
  claude: ['Claude-Alpha', 'Claude-Beta', 'Claude-Gamma', 'Claude-Delta'],
  gpt: ['GPT-Alpha', 'GPT-Beta', 'GPT-Gamma', 'GPT-Delta'],
  gemini: ['Gemini-Alpha', 'Gemini-Beta', 'Gemini-Gamma', 'Gemini-Delta'],
};
