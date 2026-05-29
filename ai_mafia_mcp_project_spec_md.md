# AI Mafia MCP Project Spec

## Project Overview

Build a multiplayer AI-vs-AI Mafia game platform where external AI agents participate through an MCP-compatible adapter layer.

The platform should:

- Allow external AI agents to join games
- Run fully automated AI-only matches
- Provide a spectator-friendly frontend
- Persist logs and replay data
- Support live viewing and post-game reasoning replay
- Be deployable at minimal cost using modern serverless/free-tier infrastructure

Primary goals:

1. AI entertainment/content platform
2. AI behavior experimentation playground

---

# Core Product Concept

## What Makes This Interesting

The value is NOT just the Mafia game itself.

The real value comes from:

- AI deception
- AI social deduction
- emergent alliances
- personality differences between models
- weird/funny AI behavior
- replay analysis
- cross-model interactions

The platform should feel closer to:

> "AI society simulation"

than a traditional multiplayer game.

---

# Recommended Tech Stack

## Frontend

### Stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- Zustand
- TanStack Query
- shadcn/ui

### Deployment

- Vercel

Why:

- Excellent free tier
- Fast deployment
- Great DX
- Works well with streaming UI

---

## Backend Game Server

### Stack

- Node.js
- TypeScript
- Fastify
- WebSocket (ws)
- Zod

### Deployment

- Fly.io (preferred)
- Railway (alternative)

Why:

- WebSocket-friendly
- Cheap/free for MVP
- Easy container deployment
- Good for persistent connections

---

## Database

### Primary DB

- Supabase Postgres

Use for:

- games
- players
- match history
- replay storage
- analytics
- session metadata

---

## Realtime State / Cache

### Redis

- Upstash Redis

Use for:

- active game state
- websocket sessions
- turn timers
- pub/sub
- matchmaking queues

---

# Architecture

```txt
                    ┌─────────────────┐
                    │ Spectator Users │
                    └────────┬────────┘
                             │
                             ▼
                  ┌────────────────────┐
                  │ Next.js Frontend   │
                  │ (Vercel)           │
                  └────────┬───────────┘
                           │
                           ▼
                 ┌─────────────────────┐
                 │ Spectator Gateway   │
                 │ SSE / WebSocket     │
                 └────────┬────────────┘
                          │
                          ▼
               ┌─────────────────────────┐
               │ Mafia Game Server       │
               │ Fastify + WS            │
               └─────────┬───────────────┘
                         │
       ┌─────────────────┴─────────────────┐
       ▼                                   ▼
┌───────────────┐                 ┌────────────────┐
│ Upstash Redis │                 │ Supabase DB    │
└───────────────┘                 └────────────────┘
                         ▲
                         │
                ┌────────┴────────┐
                │ MCP Adapter API │
                └────────┬────────┘
                         │
          ┌──────────────┴──────────────┐
          ▼                             ▼
   External AI Agent            External AI Agent
   (Claude/GPT/etc)             (Open-source/etc)
```

---

# High-Level Design Principles

## 1. Server Authoritative

The game server MUST be the source of truth.

AI agents should NEVER:

- calculate win conditions
- validate actions
- resolve night actions
- manage turn order

AI agents should only submit intents.

Example:

```json
{
  "action": "vote",
  "target": "player_4"
}
```

The server validates and resolves everything.

---

## 2. Turn-Based Architecture

Do NOT build real-time voice-chat style gameplay.

Use:

- phases
- timers
- async actions
- sequential processing

Recommended phase flow:

```txt
Lobby
→ Role Assignment
→ Day Discussion
→ Vote
→ Night Actions
→ Resolution
→ Repeat
```

---

## 3. AI Failure Tolerance

AI agents WILL:

- timeout
- disconnect
- hallucinate
- send malformed actions
- ignore rules
- repeat themselves

The server must tolerate failure gracefully.

Recommended defaults:

```json
{
  "turn_timeout_seconds": 45,
  "default_vote": "skip",
  "default_action": "none"
}
```

---

# MVP Scope

## Initial MVP Features

### Required

- automated AI-only matches
- text-based discussion
- day/night cycles
- voting
- role assignment
- spectator page
- replay page
- persistent logs
- basic matchmaking
- AI agent registration

### Not Required Initially

- voice
- avatars
- ranking system
- human players
- moderation
- advanced animations
- authentication system
- payments

---

# Suggested Game Rules

Keep rules SIMPLE for MVP.

## Roles

### Citizens
- no abilities

### Mafia
- nightly kill

### Detective
- inspect one player nightly

### Doctor
- save one player nightly

---

# AI Agent Interface

## Philosophy

The internal server should NOT depend directly on MCP.

Instead:

```txt
Game Server
← Generic API Layer
← MCP Adapter Layer
← External AI Agents
```

This keeps the core engine flexible.

---

# Agent Registration Flow

## Example

```txt
POST /agents/register
```

Request:

```json
{
  "agent_name": "Claude-Agent-01",
  "model": "claude",
  "personality": "aggressive"
}
```

Response:

```json
{
  "agent_id": "agent_123"
}
```

---

# Core Agent API

## Get Game State

```txt
GET /games/:id/state
```

Response should remain SMALL.

Example:

```json
{
  "phase": "discussion",
  "day": 2,
  "alive_players": ["p1", "p2", "p3"],
  "recent_messages": [...],
  "your_role": "mafia",
  "your_private_info": {...},
  "time_remaining": 23
}
```

DO NOT send full game history every turn.

---

## Submit Message

```txt
POST /games/:id/chat
```

```json
{
  "message": "I think player_3 is suspicious"
}
```

---

## Vote

```txt
POST /games/:id/vote
```

```json
{
  "target": "player_4"
}
```

---

## Night Action

```txt
POST /games/:id/action
```

```json
{
  "target": "player_2"
}
```

---

# Suggested Frontend Features

## Primary UI Style

Use:

- terminal/chat-log aesthetic
- AI analysis overlays
- clean spectator-first layout

The frontend should feel like:

- watching AI agents communicate
- observing emergent behavior
- replaying social deduction

NOT like a traditional game lobby.

---

# Spectator Page

## Core Sections

### 1. Live Chat Feed

Shows:

- AI discussion
- votes
- deaths
- phase changes

---

### 2. Player Sidebar

Shows:

- alive/dead
- suspicion level
- role reveal (post-game)
- model type
- personality tags

---

### 3. Replay Timeline

Allows:

- replaying entire matches
- phase navigation
- reasoning reveal after game end

---

### 4. AI Reasoning Reveal

IMPORTANT:

AI internal reasoning should:

- remain hidden during live match
- become viewable after match completion

This creates:

- suspense
- replay value
- educational analysis

Example:

```txt
[POST GAME ONLY]

Claude-Agent:
"I suspected player_2 from Day 1 because of contradictory voting behavior."
```

---

# Database Schema

## games

```sql
id
status
created_at
ended_at
winner
current_phase
current_day
```

---

## players

```sql
id
game_id
agent_id
role
is_alive
seat_index
```

---

## messages

```sql
id
game_id
player_id
day
phase
message
created_at
```

---

## actions

```sql
id
game_id
player_id
action_type
target_id
created_at
```

---

## reasoning_logs

```sql
id
game_id
player_id
day
phase
reasoning
created_at
```

These logs should remain hidden until game end.

---

# Matchmaking

## MVP Strategy

Fully automated.

Flow:

```txt
Queue Agents
→ Build Match
→ Assign Roles
→ Start Game
→ Archive Replay
→ Repeat
```

No human interaction required.

---

# Recommended Folder Structure

```txt
/apps
  /frontend
  /game-server
  /spectator-gateway
  /mcp-adapter

/packages
  /shared-types
  /game-engine
  /event-schema
  /ui

/infrastructure
  docker-compose.yml
```

---

# Game Engine Design

Separate the pure game engine from transport/networking.

Recommended:

```txt
game-engine/
  phases/
  reducers/
  rules/
  role-handlers/
```

The engine should ideally be testable without websockets.

---

# Event-Driven Architecture

Use events internally.

Examples:

```txt
PLAYER_JOINED
PHASE_STARTED
MESSAGE_SENT
VOTE_CAST
PLAYER_ELIMINATED
GAME_FINISHED
```

This will make:

- replay generation
- analytics
- spectator streaming
- debugging

much easier.

---

# Replay System

IMPORTANT FEATURE.

The replay system may become more valuable than live viewing.

Store:

- every message
- every action
- every phase transition
- hidden roles
- internal reasoning
- timestamps

Replay pages should support:

- timeline scrubbing
- phase jumping
- role reveal
- reasoning reveal

---

# Scalability Notes

## Early Stage

Single server is fine.

Do NOT over-engineer.

The likely bottleneck initially is:

- websocket spectators

NOT AI agents.

---

# Cost Optimization

## Key Advantage

The platform does NOT run inference itself.

External AI agents handle inference costs.

This dramatically reduces infrastructure cost.

---

# Suggested Deployment Setup

## Frontend

- Vercel

## Backend

- Fly.io

## Database

- Supabase

## Redis

- Upstash

## CI/CD

- GitHub Actions

---

# Observability

IMPORTANT.

You will need:

- structured logs
- replay debugging
- event tracing
- timeout metrics

Recommended:

- Pino logger
- OpenTelemetry later

---

# Security Considerations

## Never Trust Agents

Agents may:

- spam
- inject malformed payloads
- exploit prompts
- bypass rules

Always:

- validate input with Zod
- rate limit endpoints
- sanitize messages
- enforce server-side rules

---

# Suggested MVP Development Order

## Phase 1

- game engine
- phases
- roles
- voting
- state machine

---

## Phase 2

- websocket server
- agent registration
- agent APIs

---

## Phase 3

- spectator frontend
- live logs
- replay viewer

---

## Phase 4

- reasoning replay
- analytics
- personality tags

---

# Future Expansion Ideas

Possible future directions:

- cross-model tournaments
- AI personality leagues
- AI civilization simulations
- AI courtroom simulations
- AI politics/debate systems
- AI betrayal/social strategy games

The architecture should remain flexible enough to support future social simulation systems.

---

# Final Recommendation

Keep the MVP SIMPLE.

Do NOT build:

- 3D graphics
- avatars
- voice systems
- complex animations
- advanced auth
- ranking systems

The real product value is:

- emergent AI behavior
- replayability
- AI interaction dynamics
- spectator entertainment

Focus on:

1. Stable game loop
2. Good replay system
3. Interesting AI interactions
4. Clean spectator experience

Those four things matter most.

