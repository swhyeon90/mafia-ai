import type { AgentGameView } from '@mafia-ai/shared-types';
import type { LLMProvider } from './llm/types';
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
  private llm: LLMProvider;
  private currentGameId: string | null = null;
  private lastPhase: string | null = null;
  private messagesThisPhase = 0;
  private hasVotedThisPhase = false;
  private hasActedThisNight = false;
  private stopped = false;

  constructor(client: AgentClient, personality: string, llm: LLMProvider) {
    this.client = client;
    this.personality = personality;
    this.llm = llm;
  }

  async start(): Promise<void> {
    console.log(`[${this.client.agentName}] Starting agent loop`);
    await this.client.joinQueue();

    while (!this.stopped) {
      await this.tick();
      await sleep(agentConfig.pollIntervalMs);
    }
  }

  stop(): void {
    this.stopped = true;
  }

  private async tick(): Promise<void> {
    if (!this.currentGameId) {
      await this.findGame();
      return;
    }

    const state = await this.client.getGameState(this.currentGameId);
    if (!state) {
      this.currentGameId = null;
      return;
    }

    if (state.status === 'finished') {
      console.log(`[${this.client.agentName}] Game finished. Winner: ${state.winner}`);
      this.currentGameId = null;
      await this.client.joinQueue();
      return;
    }

    if (state.phase !== this.lastPhase) {
      this.lastPhase = state.phase;
      this.messagesThisPhase = 0;
      this.hasVotedThisPhase = false;
      this.hasActedThisNight = false;
    }

    const ourPlayer = state.players.find((p) => p.id === state.yourPlayerId);
    if (!ourPlayer?.isAlive) return;

    switch (state.phase) {
      case 'discussion': await this.handleDiscussion(state); break;
      case 'voting':     await this.handleVoting(state);     break;
      case 'night':      await this.handleNight(state);      break;
    }
  }

  private async findGame(): Promise<void> {
    const games = await this.client.listActiveGames();
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
    if (state.timeRemainingMs < 5000) return;

    try {
      const prompt = buildDiscussionPrompt(
        this.client.agentName,
        this.personality,
        state,
        this.messagesThisPhase,
      );

      const message = await this.llm.complete(
        `You are ${this.client.agentName}, an AI agent playing a social deduction game. Respond concisely and stay in character.`,
        prompt,
        150,
      );
      if (!message) return;

      const ok = await this.client.sendMessage(
        this.currentGameId!,
        message,
        `Round ${this.messagesThisPhase + 1} discussion reasoning`,
      );

      if (ok) {
        console.log(`[${this.client.agentName}] 💬 "${message}"`);
        this.messagesThisPhase++;
      }
    } catch (err) {
      console.error(`[${this.client.agentName}] Discussion error:`, err);
    }

    await sleep(3000 + Math.random() * 5000);
  }

  private async handleVoting(state: AgentGameView): Promise<void> {
    if (this.hasVotedThisPhase) return;

    try {
      const prompt = buildVotePrompt(this.client.agentName, this.personality, state);

      const text = await this.llm.complete(
        'You are playing a Mafia game. Respond ONLY with the JSON object requested.',
        prompt,
        200,
      );

      const parsed = parseJsonResponse(text) as { target?: string } | null;
      const target = parsed?.target ?? 'skip';

      console.log(`[${this.client.agentName}] 🗳️ Voting for: ${target}`);
      await this.client.castVote(this.currentGameId!, target);
    } catch (err) {
      console.error(`[${this.client.agentName}] Voting error:`, err);
      await this.client.castVote(this.currentGameId!, 'skip').catch(() => {});
    }

    this.hasVotedThisPhase = true;
  }

  private async handleNight(state: AgentGameView): Promise<void> {
    if (this.hasActedThisNight) return;
    if (state.yourRole === 'citizen') {
      this.hasActedThisNight = true;
      return;
    }

    try {
      const prompt = buildNightActionPrompt(this.client.agentName, this.personality, state);

      const text = await this.llm.complete(
        'You are playing a Mafia game. Respond ONLY with the JSON object requested.',
        prompt,
        200,
      );

      const parsed = parseJsonResponse(text) as { target?: string; reasoning?: string } | null;
      const target = parsed?.target ?? 'skip';

      console.log(`[${this.client.agentName}] 🌙 Night: ${state.yourRole} → ${target}`);
      await this.client.submitNightAction(this.currentGameId!, target, parsed?.reasoning);
    } catch (err) {
      console.error(`[${this.client.agentName}] Night action error:`, err);
      await this.client.submitNightAction(this.currentGameId!, 'skip').catch(() => {});
    }

    this.hasActedThisNight = true;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseJsonResponse(text: string): unknown {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}
