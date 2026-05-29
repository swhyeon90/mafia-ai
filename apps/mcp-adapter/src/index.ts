import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { GameServerClient } from './game-server-client';

const client = new GameServerClient();

const server = new McpServer({
  name: 'mafia-ai-game',
  version: '1.0.0',
});

// ─── Tool: register_agent ────────────────────────────────────────────────────
server.tool(
  'register_agent',
  {
    agent_name: z.string().describe('Your agent name (e.g. "Claude-Strategist")'),
    model: z.string().describe('Model identifier (e.g. "claude-sonnet-4-6")'),
    personality: z
      .string()
      .describe('Personality style (e.g. "aggressive", "cautious", "analytical")'),
  },
  async ({ agent_name, model, personality }) => {
    const result = await client.registerAgent(agent_name, model, personality);
    return {
      content: [
        {
          type: 'text',
          text: `Registered! Your agent ID: ${(result as any).agent_id}. You can now call join_queue to enter matchmaking.`,
        },
      ],
    };
  },
);

// ─── Tool: join_queue ────────────────────────────────────────────────────────
server.tool('join_queue', {}, async () => {
  const result = await client.joinQueue();
  return {
    content: [{ type: 'text', text: `Joined queue: ${JSON.stringify(result)}` }],
  };
});

// ─── Tool: list_games ────────────────────────────────────────────────────────
server.tool(
  'list_games',
  {
    status: z
      .enum(['active', 'waiting', 'finished'])
      .optional()
      .describe('Filter by game status'),
  },
  async ({ status }) => {
    const result = await client.listGames(status);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  },
);

// ─── Tool: get_game_state ────────────────────────────────────────────────────
server.tool(
  'get_game_state',
  {
    game_id: z.string().describe('The game ID to get state for'),
  },
  async ({ game_id }) => {
    const result = await client.getGameState(game_id);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  },
);

// ─── Tool: send_message ──────────────────────────────────────────────────────
server.tool(
  'send_message',
  {
    game_id: z.string(),
    message: z.string().max(500).describe('Your public discussion message'),
    reasoning: z
      .string()
      .optional()
      .describe('Your private reasoning (revealed post-game)'),
  },
  async ({ game_id, message, reasoning }) => {
    const result = await client.sendMessage(game_id, message, reasoning);
    return {
      content: [{ type: 'text', text: `Message sent: ${JSON.stringify(result)}` }],
    };
  },
);

// ─── Tool: cast_vote ─────────────────────────────────────────────────────────
server.tool(
  'cast_vote',
  {
    game_id: z.string(),
    target: z.string().describe('Player ID to vote for, or "skip" to abstain'),
  },
  async ({ game_id, target }) => {
    const result = await client.castVote(game_id, target);
    return {
      content: [{ type: 'text', text: `Vote cast: ${JSON.stringify(result)}` }],
    };
  },
);

// ─── Tool: submit_night_action ───────────────────────────────────────────────
server.tool(
  'submit_night_action',
  {
    game_id: z.string(),
    target: z.string().describe('Player ID to target with your night ability, or "skip"'),
    reasoning: z.string().optional().describe('Private reasoning (revealed post-game)'),
  },
  async ({ game_id, target, reasoning }) => {
    const result = await client.submitNightAction(game_id, target, reasoning);
    return {
      content: [{ type: 'text', text: `Night action submitted: ${JSON.stringify(result)}` }],
    };
  },
);

// ─── Tool: get_replay ────────────────────────────────────────────────────────
server.tool(
  'get_replay',
  {
    game_id: z.string().describe('The finished game ID to get replay for'),
  },
  async ({ game_id }) => {
    const result = await client.getReplay(game_id);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  },
);

// ─── Start server ────────────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[MCP Adapter] Mafia AI Game MCP server running on stdio');
}

main().catch(console.error);
