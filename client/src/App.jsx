import { useState, useCallback } from 'react';
import Header from './components/Header.jsx';
import Dashboard from './components/Dashboard.jsx';
import StartDialog from './components/StartDialog.jsx';
import Terminal from './components/Terminal.jsx';
import { useWebSocket } from './hooks/useWebSocket.js';

// In Electron: server and frontend share the same port (dynamic)
// In dev mode: frontend on 5173, server on 3001
const WS_URL = window.location.port === '5173'
  ? `ws://${window.location.hostname}:3001`
  : `ws://${window.location.host}`;

export default function App() {
  const { processes, saved, connected, logs, subscribeLogs, refresh } = useWebSocket(WS_URL);
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [terminalPid, setTerminalPid] = useState(null);

  const handleStop = useCallback(async (pid) => {
    const res = await fetch(`/api/processes/${pid}/stop`, { method: 'POST' });
    refresh();
    return res.json();
  }, [refresh]);

  const handleStart = useCallback(async ({ dir, command, port }) => {
    const res = await fetch('/api/processes/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dir, command, port })
    });
    setTimeout(refresh, 1000);
    return res.json();
  }, [refresh]);

  const handleSave = useCallback(async ({ name, dir, command, port }) => {
    const res = await fetch('/api/saved', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, dir, command, port })
    });
    refresh();
    return res.json();
  }, [refresh]);

  const handleRemoveSaved = useCallback(async (dir) => {
    await fetch('/api/saved', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dir })
    });
    refresh();
  }, [refresh]);

  const handleStopPort = useCallback(async (port) => {
    const res = await fetch(`/api/port/${port}/stop`, { method: 'POST' });
    setTimeout(refresh, 500);
    return res.json();
  }, [refresh]);

  const handleShowLogs = useCallback((pid) => {
    setTerminalPid(pid);
    subscribeLogs(pid);
  }, [subscribeLogs]);

  return (
    <div className="min-h-screen bg-dark-900">
      <Header
        processes={processes}
        connected={connected}
        onOpenStartDialog={() => setShowStartDialog(true)}
        onRefresh={refresh}
      />

      <main className="max-w-7xl mx-auto px-4 py-6">
        <Dashboard
          processes={processes}
          saved={saved}
          onStop={handleStop}
          onStopPort={handleStopPort}
          onShowLogs={handleShowLogs}
          onSave={handleSave}
          onStart={handleStart}
          onRemoveSaved={handleRemoveSaved}
        />
      </main>

      {showStartDialog && (
        <StartDialog
          onClose={() => setShowStartDialog(false)}
          onStart={handleStart}
        />
      )}

      {terminalPid !== null && (
        <Terminal
          pid={terminalPid}
          logs={logs[terminalPid] || []}
          onClose={() => setTerminalPid(null)}
        />
      )}
    </div>
  );
}
