'use client';

import { useState, useEffect, useCallback } from 'react';

const SERVER = process.env.NEXT_PUBLIC_GAME_SERVER_URL ?? 'http://localhost:3001';

const MODELS = [
  'claude-sonnet-4-6',
  'claude-opus-4-8',
  'claude-haiku-4-5',
  'gpt-4o',
  'gpt-4o-mini',
];

const PERSONALITIES = ['aggressive', 'cautious', 'analytical', 'friendly', 'deceptive', 'random'];

type Agent = {
  agent_id: string;
  api_key: string;
  agent_name: string;
  model: string;
  personality: string;
  queued: boolean;
};

type QueueStatus = { queue_length: number; agents: string[] };
type Log = { ts: string; msg: string; ok: boolean };

async function post(path: string, body?: unknown, apiKey?: string) {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  const res = await fetch(`${SERVER}${path}`, {
    method: 'POST',
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  return { ok: res.ok, status: res.status, data: json };
}

async function del(path: string, apiKey: string) {
  const res = await fetch(`${SERVER}${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  return { ok: res.ok, data: await res.json() };
}

export default function TestPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [queue, setQueue] = useState<QueueStatus>({ queue_length: 0, agents: [] });

  // spawn form
  const [count, setCount] = useState(4);
  const [prefix, setPrefix] = useState('Bot');
  const [model, setModel] = useState(MODELS[0]);
  const [personality, setPersonality] = useState('random');
  const [spawning, setSpawning] = useState(false);

  const log = (msg: string, ok = true) =>
    setLogs((prev) => [{ ts: new Date().toLocaleTimeString(), msg, ok }, ...prev].slice(0, 100));

  const refreshQueue = useCallback(async () => {
    try {
      const res = await fetch(`${SERVER}/queue`);
      const data = await res.json();
      setQueue(data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    refreshQueue();
    const id = setInterval(refreshQueue, 3000);
    return () => clearInterval(id);
  }, [refreshQueue]);

  async function spawnAgents() {
    setSpawning(true);
    const newAgents: Agent[] = [];
    for (let i = 0; i < count; i++) {
      const name = `${prefix}-${Date.now().toString(36).toUpperCase()}-${i}`;
      const chosenPersonality =
        personality === 'random'
          ? PERSONALITIES[Math.floor(Math.random() * (PERSONALITIES.length - 1))]
          : personality;
      const { ok, data } = await post('/agents/register', {
        agent_name: name,
        model,
        personality: chosenPersonality,
      });
      if (ok) {
        newAgents.push({
          agent_id: data.agent_id,
          api_key: data.api_key,
          agent_name: name,
          model,
          personality: chosenPersonality,
          queued: false,
        });
        log(`Registered ${name} (${chosenPersonality})`);
      } else {
        log(`Failed to register ${name}: ${JSON.stringify(data)}`, false);
      }
    }
    setAgents((prev) => [...prev, ...newAgents]);
    setSpawning(false);
  }

  async function enqueueAgent(agent: Agent) {
    const { ok, data } = await post('/queue', undefined, agent.api_key);
    if (ok) {
      log(`Queued ${agent.agent_name} (pos ${data.queue_position}/${data.queue_length})`);
      setAgents((prev) =>
        prev.map((a) => (a.agent_id === agent.agent_id ? { ...a, queued: true } : a)),
      );
    } else {
      log(`Failed to queue ${agent.agent_name}: ${JSON.stringify(data)}`, false);
    }
    refreshQueue();
  }

  async function dequeueAgent(agent: Agent) {
    const { ok, data } = await del('/queue', agent.api_key);
    if (ok) {
      log(`Dequeued ${agent.agent_name}`);
      setAgents((prev) =>
        prev.map((a) => (a.agent_id === agent.agent_id ? { ...a, queued: false } : a)),
      );
    } else {
      log(`Failed to dequeue ${agent.agent_name}: ${JSON.stringify(data)}`, false);
    }
    refreshQueue();
  }

  async function enqueueAll() {
    const idle = agents.filter((a) => !a.queued);
    for (const a of idle) await enqueueAgent(a);
  }

  function clearAgents() {
    setAgents([]);
    log('Cleared local agent list (server still has them)');
  }

  const idleCount = agents.filter((a) => !a.queued).length;
  const queuedCount = agents.filter((a) => a.queued).length;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6 font-mono text-sm">
      <h1 className="text-xl font-bold text-purple-400 mb-1">Mafia AI — Test Panel</h1>
      <p className="text-gray-500 mb-6 text-xs">
        Register dummy agents and push them into the matchmaking queue.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: controls */}
        <div className="space-y-4">
          {/* Spawn form */}
          <section className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">
            <h2 className="text-purple-300 font-semibold">Spawn Agents</h2>

            <label className="block">
              <span className="text-gray-400 text-xs">Count</span>
              <input
                type="number"
                min={1}
                max={8}
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(8, Number(e.target.value))))}
                className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white focus:outline-none focus:border-purple-500"
              />
            </label>

            <label className="block">
              <span className="text-gray-400 text-xs">Name Prefix</span>
              <input
                type="text"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white focus:outline-none focus:border-purple-500"
              />
            </label>

            <label className="block">
              <span className="text-gray-400 text-xs">Model</span>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white focus:outline-none focus:border-purple-500"
              >
                {MODELS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-gray-400 text-xs">Personality</span>
              <select
                value={personality}
                onChange={(e) => setPersonality(e.target.value)}
                className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white focus:outline-none focus:border-purple-500"
              >
                {PERSONALITIES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </label>

            <button
              onClick={spawnAgents}
              disabled={spawning}
              className="w-full bg-purple-700 hover:bg-purple-600 disabled:opacity-40 rounded py-1.5 font-semibold transition"
            >
              {spawning ? 'Spawning…' : `Spawn ${count} agent${count !== 1 ? 's' : ''}`}
            </button>
          </section>

          {/* Queue status */}
          <section className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-purple-300 font-semibold">Queue</h2>
              <button onClick={refreshQueue} className="text-gray-500 hover:text-gray-300 text-xs">↻ refresh</button>
            </div>
            <div className="flex gap-4 text-lg font-bold">
              <span className="text-green-400">{queue.queue_length} <span className="text-xs font-normal text-gray-400">in queue</span></span>
              <span className="text-yellow-400">{idleCount} <span className="text-xs font-normal text-gray-400">idle here</span></span>
            </div>
            <p className="text-gray-500 text-xs">Game starts when queue ≥ 4 (every 5 s)</p>
          </section>

          {/* Bulk actions */}
          {agents.length > 0 && (
            <section className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-2">
              <h2 className="text-purple-300 font-semibold">Bulk Actions</h2>
              <button
                onClick={enqueueAll}
                disabled={idleCount === 0}
                className="w-full bg-green-800 hover:bg-green-700 disabled:opacity-40 rounded py-1.5 font-semibold transition"
              >
                Enqueue all idle ({idleCount})
              </button>
              <button
                onClick={clearAgents}
                className="w-full bg-gray-800 hover:bg-gray-700 rounded py-1.5 text-gray-400 transition"
              >
                Clear list
              </button>
            </section>
          )}
        </div>

        {/* Middle: agent list */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-purple-300 font-semibold">
              Agents <span className="text-gray-500 font-normal">({agents.length})</span>
            </h2>
            <span className="text-xs text-gray-500">{queuedCount} queued</span>
          </div>

          {agents.length === 0 ? (
            <p className="text-gray-600 text-xs">No agents yet. Spawn some above.</p>
          ) : (
            <ul className="space-y-2 overflow-y-auto max-h-[60vh]">
              {agents.map((a) => (
                <li
                  key={a.agent_id}
                  className="flex items-center justify-between bg-gray-800 rounded px-3 py-2 gap-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${a.queued ? 'bg-green-400' : 'bg-gray-600'}`}
                      />
                      <span className="truncate font-semibold text-white">{a.agent_name}</span>
                    </div>
                    <div className="text-gray-500 text-xs ml-4 truncate">
                      {a.personality} · {a.model.split('-').slice(0, 2).join('-')}
                    </div>
                  </div>
                  <button
                    onClick={() => (a.queued ? dequeueAgent(a) : enqueueAgent(a))}
                    className={`shrink-0 text-xs px-2 py-1 rounded transition ${
                      a.queued
                        ? 'bg-red-900 hover:bg-red-800 text-red-300'
                        : 'bg-green-900 hover:bg-green-800 text-green-300'
                    }`}
                  >
                    {a.queued ? 'Dequeue' : 'Enqueue'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Right: log */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-purple-300 font-semibold">Log</h2>
            <button onClick={() => setLogs([])} className="text-gray-500 hover:text-gray-300 text-xs">clear</button>
          </div>
          {logs.length === 0 ? (
            <p className="text-gray-600 text-xs">Nothing yet.</p>
          ) : (
            <ul className="space-y-1 overflow-y-auto max-h-[60vh]">
              {logs.map((l, i) => (
                <li key={i} className={`text-xs ${l.ok ? 'text-gray-300' : 'text-red-400'}`}>
                  <span className="text-gray-600 mr-2">{l.ts}</span>
                  {l.msg}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
