'use client';

import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/game-store';
import { WS_BASE } from '@/lib/api';

export function useGameSocket(gameId: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const { setGame, updateFromEvent, setConnected, setSpectatorCount } = useGameStore();

  useEffect(() => {
    const url = `${WS_BASE}/ws?gameId=${gameId}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
    };

    ws.onclose = () => {
      setConnected(false);
    };

    ws.onerror = () => {
      setConnected(false);
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string) as {
          type: string;
          payload: Record<string, unknown>;
        };

        switch (msg.type) {
          case 'snapshot':
            setGame(msg.payload as any);
            break;
          case 'connected':
            setSpectatorCount((msg.payload as any).spectatorCount ?? 0);
            break;
          case 'event':
            updateFromEvent(msg.payload as any);
            break;
          case 'timer':
            // Update deadline in game state
            break;
        }
      } catch {
        // ignore malformed
      }
    };

    // Ping every 30s to keep connection alive
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30_000);

    return () => {
      clearInterval(pingInterval);
      ws.close();
      setConnected(false);
    };
  }, [gameId]);

  return { ws: wsRef.current };
}
