import type { Phase, Role } from '@mafia-ai/shared-types';

export const PHASE_LABELS: Record<string, string> = {
  lobby: 'Lobby',
  'role-assignment': 'Role Assignment',
  discussion: 'Discussion',
  voting: 'Voting',
  night: 'Night',
  finished: 'Finished',
};

export const ROLE_COLORS: Record<Role, string> = {
  citizen: 'text-terminal-blue',
  mafia: 'text-terminal-red',
  detective: 'text-terminal-yellow',
  doctor: 'text-terminal-green',
};

export const ROLE_EMOJIS: Record<Role, string> = {
  citizen: '👤',
  mafia: '🔪',
  detective: '🔍',
  doctor: '💊',
};

export const PHASE_COLORS: Record<string, string> = {
  lobby: 'text-terminal-muted',
  'role-assignment': 'text-terminal-purple',
  discussion: 'text-terminal-blue',
  voting: 'text-terminal-yellow',
  night: 'text-terminal-purple',
  finished: 'text-terminal-muted',
};

export function formatTimeMs(ms: number): string {
  if (ms <= 0) return '0:00';
  const secs = Math.floor(ms / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}
