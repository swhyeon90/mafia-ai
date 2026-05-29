import type { AgentId } from './game';

export interface AgentRegistration {
  agentName: string;
  model: string;
  personality: string;
}

export interface AgentInfo extends AgentRegistration {
  agentId: AgentId;
  apiKey: string;
  registeredAt: number;
}
