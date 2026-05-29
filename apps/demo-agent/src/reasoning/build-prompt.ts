import type { AgentGameView } from '@mafia-ai/shared-types';

const ROLE_DESCRIPTIONS = {
  citizen: 'You are a Citizen. You have no special abilities. Survive and help eliminate all Mafia.',
  mafia: 'You are Mafia. Your goal is to eliminate all non-Mafia players without being discovered. Blend in!',
  detective:
    'You are the Detective. Each night you can investigate one player to learn their role. Use this information wisely to help the Citizens win.',
  doctor:
    'You are the Doctor. Each night you can protect one player (including yourself) from being killed. Save key players.',
};

export function buildDiscussionPrompt(
  agentName: string,
  personality: string,
  state: AgentGameView,
  messageIndex: number,
): string {
  const alivePlayers = state.players.filter((p) => p.isAlive);
  const deadPlayers = state.players.filter((p) => !p.isAlive);

  const roleDesc = ROLE_DESCRIPTIONS[state.yourRole];
  const mafiaInfo =
    state.yourRole === 'mafia' && state.yourPrivateInfo.mafiaTeam
      ? `\nYour Mafia teammates: ${state.yourPrivateInfo.mafiaTeam.map((id) => {
          const p = state.players.find((pl) => pl.id === id);
          return p?.agentName ?? id;
        }).join(', ')}`
      : '';

  const inspectInfo =
    state.yourRole === 'detective' && state.yourPrivateInfo.inspectHistory?.length
      ? `\nYour investigation results:\n${state.yourPrivateInfo.inspectHistory
          .map((r) => {
            const target = state.players.find((p) => p.id === r.targetId);
            return `  Day ${r.day}: ${target?.agentName ?? r.targetId} is ${r.role.toUpperCase()}`;
          })
          .join('\n')}`
      : '';

  const recentChat = state.recentMessages
    .slice(-10)
    .map((m) => `${m.playerName}: "${m.content}"`)
    .join('\n');

  const aliveList = alivePlayers
    .map((p) => `- ${p.agentName} (${p.model}, ${p.personality}${p.id === state.yourPlayerId ? ' ← YOU' : ''})`)
    .join('\n');

  const deadList = deadPlayers.length
    ? deadPlayers.map((p) => `- ${p.agentName}${p.role ? ` [${p.role}]` : ''}`).join('\n')
    : 'None yet';

  return `You are ${agentName} playing a Mafia social deduction game.
Personality: ${personality}
${roleDesc}${mafiaInfo}${inspectInfo}

=== GAME STATE ===
Day: ${state.day}
Phase: Discussion
Time remaining: ~${Math.round(state.timeRemainingMs / 1000)}s

Alive players:
${aliveList}

Eliminated players:
${deadList}

Recent discussion:
${recentChat || '(no messages yet)'}

=== YOUR TASK ===
${messageIndex === 0 ? 'Start or continue the discussion. Share your observations, suspicions, or defend yourself.' : 'Follow up on the discussion with an additional observation or argument.'}

Rules:
- Keep your message SHORT (1-2 sentences, max 200 characters)
- Stay in character as ${agentName}
- Reference specific players by name
- Be strategic based on your role
${state.yourRole === 'mafia' ? '- As Mafia, deflect suspicion and frame innocent players subtly' : '- As a town player, reason carefully and share genuine suspicions'}

Respond with ONLY your message. No quotes, no prefix.`;
}

export function buildVotePrompt(
  agentName: string,
  personality: string,
  state: AgentGameView,
): string {
  const alivePlayers = state.players.filter((p) => p.isAlive && p.id !== state.yourPlayerId);
  const roleDesc = ROLE_DESCRIPTIONS[state.yourRole];
  const inspectInfo =
    state.yourRole === 'detective' && state.yourPrivateInfo.inspectHistory?.length
      ? `\nYour investigation results:\n${state.yourPrivateInfo.inspectHistory
          .map((r) => {
            const target = state.players.find((p) => p.id === r.targetId);
            return `  Day ${r.day}: ${target?.agentName ?? r.targetId} is ${r.role.toUpperCase()}`;
          })
          .join('\n')}`
      : '';

  const mafiaInfo =
    state.yourRole === 'mafia' && state.yourPrivateInfo.mafiaTeam
      ? `\nYour Mafia teammates: ${state.yourPrivateInfo.mafiaTeam.map((id) => {
          const p = state.players.find((pl) => pl.id === id);
          return p?.agentName ?? id;
        }).join(', ')}\nIMPORTANT: Do NOT vote for your Mafia teammates.`
      : '';

  const recentChat = state.recentMessages
    .slice(-15)
    .map((m) => `${m.playerName}: "${m.content}"`)
    .join('\n');

  const voteOptions = alivePlayers.map((p) => `- ${p.agentName} (ID: ${p.id})`).join('\n');
  const currentTally = Object.entries(state.voteTally)
    .map(([targetId, count]) => {
      const target = state.players.find((p) => p.id === targetId);
      return `  ${target?.agentName ?? targetId}: ${count} votes`;
    })
    .join('\n');

  return `You are ${agentName} in a Mafia game. It's time to vote.
Personality: ${personality}
${roleDesc}${mafiaInfo}${inspectInfo}

=== GAME STATE ===
Day: ${state.day}
Time remaining: ~${Math.round(state.timeRemainingMs / 1000)}s

Discussion summary:
${recentChat || '(no discussion)'}

Current vote tally:
${currentTally || '(no votes yet)'}

Vote options (alive players):
${voteOptions}

=== YOUR TASK ===
Who do you vote to eliminate? Choose strategically.

Respond with a JSON object:
{
  "target": "<player-id or 'skip'>",
  "reasoning": "<brief internal reasoning>"
}

Use the exact player ID from the list above, or "skip" to abstain.`;
}

export function buildNightActionPrompt(
  agentName: string,
  personality: string,
  state: AgentGameView,
): string {
  const alivePlayers = state.players.filter(
    (p) => p.isAlive && p.id !== state.yourPlayerId,
  );
  const roleDesc = ROLE_DESCRIPTIONS[state.yourRole];

  const mafiaInfo =
    state.yourRole === 'mafia' && state.yourPrivateInfo.mafiaTeam
      ? `\nYour Mafia teammates: ${state.yourPrivateInfo.mafiaTeam.map((id) => {
          const p = state.players.find((pl) => pl.id === id);
          return p?.agentName ?? id;
        }).join(', ')}\nChoose a target who is NOT a Mafia member.`
      : '';

  const inspectInfo =
    state.yourRole === 'detective' && state.yourPrivateInfo.inspectHistory?.length
      ? `\nPrevious investigations:\n${state.yourPrivateInfo.inspectHistory
          .map((r) => {
            const target = state.players.find((p) => p.id === r.targetId);
            return `  Day ${r.day}: ${target?.agentName ?? r.targetId} is ${r.role.toUpperCase()}`;
          })
          .join('\n')}`
      : '';

  const abilityInstruction = {
    mafia: 'Choose a player to ELIMINATE tonight.',
    detective: 'Choose a player to INVESTIGATE tonight (you will learn their role).',
    doctor: 'Choose a player to PROTECT tonight (they cannot be killed). You can protect yourself.',
    citizen: 'You have no night action.',
  }[state.yourRole];

  const options = alivePlayers.map((p) => `- ${p.agentName} (ID: ${p.id})`).join('\n');
  const selfOption = state.yourRole === 'doctor'
    ? `\n- ${agentName} (yourself, ID: ${state.yourPlayerId})`
    : '';

  return `You are ${agentName} in a Mafia game. It is Night ${state.day}.
${roleDesc}${mafiaInfo}${inspectInfo}

${abilityInstruction}

Alive targets:
${options}${selfOption}

=== YOUR TASK ===
Choose your night action target. Be strategic.

Respond with a JSON object:
{
  "target": "<player-id>",
  "reasoning": "<brief internal reasoning>"
}`;
}
