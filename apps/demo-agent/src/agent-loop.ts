import Anthropic from '@anthropic-ai/sdk';
import type { AgentGameView } from '@mafia-ai/shared-types';
import { AgentClient } from './agent-client';
import {
  buildDiscussionPrompt,
  buildVotePrompt,
  buildNightActionPrompt,
} from './reasoning/build-prompt';
import { agentConfig } from './config';

export class AgentLoop {
  private client: AgentClient;
  private personality: string;
  private anthropic: Anthropic;
  private currentGameId: string | null = null;
  private lastPhase: string | null = null;
  private messagesThisPhase = 0;
  private hasVotedThisPhase = false;
  private hasActedThisNight = false;
  private stopped = false;

  constructor(client: AgentClient, personality: string) {
    this.client = client;
    this.personality = personality;
    this.anthropic = new Anthropic({ apiKey: agentConfig.anthropicApiKey });
  }

  async start(): Promise<void> {
    console.log(`[${this.client.agentName}] Starting agent loop`);

    // Join the matchmaking queue
    await this.client.joinQueue();

    // Poll for a game to start
    while (!this.stopped) {
      await this.tick();
      await sleep(agentConfig.pollIntervalMs);
    }
  }

  stop(): void {
    this.stopped = true;
  }

  private async tick(): Promise<void> {
    // Try to find our game
    if (!this.currentGameId) {
      await this.findGame();
      return;
    }

    // Get current state
    const state = await this.client.getGameState(this.currentGameId);
    if (!state) {
      this.currentGameId = null;
      return;
    }

    // Check if game finished
    if (state.status === 'finished') {
      console.log(
        `[${this.client.agentName}] Game ${this.currentGameId} finished. Winner: ${state.winner}`,
      );
      this.currentGameId = null;
      // Rejoin queue for next game
      await this.client.joinQueue();
      return;
    }

    // Reset phase-specific state
    if (state.phase !== this.lastPhase) {
      this.lastPhase = state.phase;
      this.messagesThisPhase = 0;
      this.hasVotedThisPhase = false;
      this.hasActedThisNight = false;
    }

    // Find our player
    const ourPlayer = state.players.find((p) => p.id === state.yourPlayerId);
    if (!ourPlayer?.isAlive) return; // Dead players don't act

    switch (state.phase) {
      case 'discussion':
        await this.handleDiscussion(state);
        break;
      case 'voting':
        await this.handleVoting(state);
        break;
      case 'night':
        await this.handleNight(state);
        break;
      // Other phases: just wait
    }
  }

  private async findGame(): Promise<void> {
    const games = await this.client.listActiveGames();
    if (games.length === 0) return;

    // Find game where we are a player
    for (const game of games) {
      const state = await this.client.getGameState(game.id);
      if (state?.yourPlayerId) {
        console.log(`[${this.client.agentName}] Found game ${game.id} (${state.phase})`);
        this.currentGameId = game.id;
        return;
      }
    }
  }

  private async handleDiscussion(state: AgentGameView): Promise<void> {
    if (this.messagesThisPhase >= agentConfig.messagesPerDiscussion) return;
    if (state.timeRemainingMs < 5000) return; // Don't send if <5s left

    try {
      const prompt = buildDiscussionPrompt(
        this.client.agentName,
        this.personality,
        state,
        this.messagesThisPhase,
      );

      const response = await this.anthropic.messages.create({
        model: agentConfig.model,
        max_tokens: 150,
        messages: [{ role: 'user', content: prompt }],
        system: `You are ${this.client.agentName}, an AI agent playing a social deduction game. Respond concisely and stay in character.`,
      });

      const message = extractText(response.content);
      if (!message) return;

      const reasoning = `Round ${this.messagesThisPhase + 1} discussion reasoning`;
      const ok = await this.client.sendMessage(this.currentGameId!, message, reasoning);

      if (ok) {
        console.log(`[${this.client.agentName}] 💬 "${message}"`);
        this.messagesThisPhase++;
      }
    } catch (err) {
      console.error(`[${this.client.agentName}] Discussion error:`, err);
    }

    // Add a delay to avoid spamming
    await sleep(3000 + Math.random() * 5000);
  }

  private async handleVoting(state: AgentGameView): Promise<void> {
    if (this.hasVotedThisPhase) return;

    try {
      const prompt = buildVotePrompt(this.client.agentName, this.personality, state);

      const response = await this.anthropic.messages.create({
        model: agentConfig.model,
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
        system: 'You are playing a Mafia game. Respond ONLY with the JSON object requested.',
      });

      const text = extractText(response.content);
      if (!text) {
        // Default: skip
        await this.client.castVote(this.currentGameId!, 'skip');
        this.hasVotedThisPhase = true;
        return;
      }

      const parsed = parseJsonResponse(text) as { target?: string; reasoning?: string } | null;
      const target = parsed?.target ?? 'skip';
      const reasoning = parsed?.reasoning;

      console.log(`[${this.client.agentName}] 🗳️ Voting for: ${target}${reasoning ? ` (${reasoning})` : ''}`);
      await this.client.castVote(this.currentGameId!, target);
      this.hasVotedThisPhase = true;
    } catch (err) {
      console.error(`[${this.client.agentName}] Voting error:`, err);
      // Default vote
      await this.client.castVote(this.currentGameId!, 'skip').catch(() => {});
      this.hasVotedThisPhase = true;
    }
  }

  private async handleNight(state: AgentGameView): Promise<void> {
    if (this.hasActedThisNight) return;
    if (state.yourRole === 'citizen') {
      this.hasActedThisNight = true;
      return; // Citizens have no night action
    }

    try {
      const prompt = buildNightActionPrompt(this.client.agentName, this.personality, state);

      const response = await this.anthropic.messages.create({
        model: agentConfig.model,
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
        system: 'You are playing a Mafia game. Respond ONLY with the JSON object requested.',
      });

      const text = extractText(response.content);
      if (!text) {
        await this.client.submitNightAction(this.currentGameId!, 'skip');
        this.hasActedThisNight = true;
        return;
      }

      const parsed = parseJsonResponse(text) as { target?: string; reasoning?: string } | null;
      const target = parsed?.target ?? 'skip';
      const reasoning = parsed?.reasoning;

      console.log(
        `[${this.client.agentName}] 🌙 Night action: ${state.yourRole} → ${target}${reasoning ? ` (${reasoning})` : ''}`,
      );
      await this.client.submitNightAction(this.currentGameId!, target, reasoning);
      this.hasActedThisNight = true;
    } catch (err) {
      console.error(`[${this.client.agentName}] Night action error:`, err);
      await this.client.submitNightAction(this.currentGameId!, 'skip').catch(() => {});
      this.hasActedThisNight = true;
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractText(content: Anthropic.Messages.ContentBlock[]): string {
  for (const block of content) {
    if (block.type === 'text') return block.text.trim();
  }
  return '';
}

function parseJsonResponse(text: string): unknown {
  // Extract JSON from text (may be wrapped in markdown)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}
