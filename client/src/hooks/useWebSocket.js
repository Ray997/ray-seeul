import { useState, useEffect, useRef, useCallback } from 'react';

export function useWebSocket(url) {
  const [processes, setProcesses] = useState([]);
  const [saved, setSaved] = useState([]);
  const [connected, setConnected] = useState(false);
  const [logs, setLogs] = useState({});
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'update') {
          setProcesses(msg.processes || []);
          setSaved(msg.saved || []);
        }

        if (msg.type === 'logs') {
          setLogs(prev => ({ ...prev, [msg.pid]: msg.data }));
        }
      } catch { /* skip */ }
    };

    ws.onclose = () => {
      setConnected(false);
      reconnectRef.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => ws.close();
  }, [url]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const refresh = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'refresh' }));
    }
  }, []);

  const subscribeLogs = useCallback((pid) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'subscribeLogs', pid }));
    }
  }, []);

  return { processes, saved, connected, logs, subscribeLogs, refresh };
}
