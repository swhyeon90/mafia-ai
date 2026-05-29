import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider } from './types';

export class AnthropicLLM implements LLMProvider {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async complete(system: string, user: string, maxTokens: number): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    });
    for (const block of response.content) {
      if (block.type === 'text') return block.text.trim();
    }
    return '';
  }
}
