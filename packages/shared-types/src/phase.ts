export type Phase =
  | 'lobby'
  | 'role-assignment'
  | 'discussion'
  | 'voting'
  | 'night'
  | 'finished';

export const PHASE_ORDER: Phase[] = [
  'lobby',
  'role-assignment',
  'discussion',
  'voting',
  'night',
  'finished',
];

export const PHASE_LABELS: Record<Phase, string> = {
  lobby: 'Lobby',
  'role-assignment': 'Role Assignment',
  discussion: 'Discussion',
  voting: 'Voting',
  night: 'Night',
  finished: 'Finished',
};
