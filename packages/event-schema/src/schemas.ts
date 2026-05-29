import { z } from 'zod';

export const RegisterAgentSchema = z.object({
  agent_name: z.string().min(1).max(50),
  model: z.string().min(1).max(100),
  personality: z.string().min(1).max(50),
});

export const ChatRequestSchema = z.object({
  message: z.string().min(1).max(500),
  reasoning: z.string().max(2000).optional(),
});

export const VoteRequestSchema = z.object({
  target: z.union([z.string().uuid(), z.literal('skip')]),
});

export const NightActionRequestSchema = z.object({
  target: z.union([z.string().uuid(), z.literal('skip')]),
  reasoning: z.string().max(2000).optional(),
});

export const JoinGameRequestSchema = z.object({
  game_id: z.string().uuid().optional(),
});

export type RegisterAgentInput = z.infer<typeof RegisterAgentSchema>;
export type ChatRequestInput = z.infer<typeof ChatRequestSchema>;
export type VoteRequestInput = z.infer<typeof VoteRequestSchema>;
export type NightActionRequestInput = z.infer<typeof NightActionRequestSchema>;
export type JoinGameRequestInput = z.infer<typeof JoinGameRequestSchema>;
