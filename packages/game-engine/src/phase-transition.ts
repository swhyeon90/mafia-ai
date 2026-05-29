import type { InternalGameState, Phase } from './types';
import { DEFAULT_GAME_CONFIG } from '@mafia-ai/shared-types';

/**
 * Determine the next phase to transition to given the current state.
 * Returns null if no transition is needed yet.
 */
export function getNextPhase(state: InternalGameState): Phase | null {
  const now = Date.now();

  // Phase has not expired and not all pending actors done
  if (now < state.phaseDeadline) {
    // Check early completion
    if (state.phase === 'voting' && state.pendingVoters.size === 0) {
      return 'night';
    }
    if (state.phase === 'night' && state.pendingNightActors.size === 0) {
      return 'discussion';
    }
    return null;
  }

  // Phase deadline passed
  switch (state.phase) {
    case 'lobby':
      return null; // never auto-advance from lobby
    case 'role-assignment':
      return 'discussion';
    case 'discussion':
      return 'voting';
    case 'voting':
      return 'night'; // resolveVotes will be called before this transition
    case 'night':
      return 'discussion'; // resolveNight will be called before this transition
    case 'finished':
      return null;
    default:
      return null;
  }
}

/**
 * Calculate the deadline timestamp for a given phase.
 */
export function phaseDuration(phase: Phase, config = DEFAULT_GAME_CONFIG): number {
  switch (phase) {
    case 'role-assignment':
      return config.roleAssignmentTimeoutMs;
    case 'discussion':
      return config.discussionTimeoutMs;
    case 'voting':
      return config.votingTimeoutMs;
    case 'night':
      return config.nightTimeoutMs;
    default:
      return 0;
  }
}
