export interface LLMProvider {
  complete(system: string, user: string, maxTokens: number): Promise<string>;
}
