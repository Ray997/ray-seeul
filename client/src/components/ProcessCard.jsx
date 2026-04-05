import { useState } from 'react';

export default function ProcessCard({ process, isSaved, onStop, onShowLogs, onSave, onRemoveSaved, onStopPort }) {
  const [stopping, setStopping] = useState(false);
  const [stoppingPort, setStoppingPort] = useState(null);
  const [justSaved, setJustSaved] = useState(false);

  const handleStop = async () => {
    setStopping(true);
    try { await onStop(process.pid); }
    finally { setTimeout(() => setStopping(false), 2000); }
  };

  const handleStopPort = async (port) => {
    setStoppingPort(port);
    try { await onStopPort(port); }
    finally { setTimeout(() => setStoppingPort(null), 2000); }
  };

  const handleToggleSave = async () => {
    if (isSaved) {
      await onRemoveSaved(process.projectDir || process.cwd);
    } else {
      await onSave({
        name: process.projectName,
        dir: process.projectDir || process.cwd,
        command: process.command,
        port: process.ports[0] || null
      });
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    }
  };

  const shortCmd = process.command.length > 80
    ? process.command.substring(0, 80) + '...'
    : process.command;

  return (
    <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 hover:border-dark-600 transition-all fade-in group">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 pulse-green flex-shrink-0" />
          <div className="min-w-0">
            <h3 className="text-white font-semibold text-sm truncate">
              {process.projectName || 'Unknown'}
            </h3>
            <div className="flex items-center gap-1.5">
              <span className="text-dark-400 text-[11px]">PID: {process.pid}</span>
              {isSaved && <span className="text-[9px] px-1.5 py-0.5 bg-amber-500/10 text-amber-400 rounded">Saved</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {(process.projectDir || process.cwd) && (
            <button onClick={handleToggleSave}
              className={`p-1.5 rounded-md transition-colors ${isSaved || justSaved ? 'text-amber-400 hover:text-red-400' : 'hover:bg-dark-700 text-dark-400 hover:text-amber-400'}`}
              title={isSaved ? 'Remove Bookmark' : 'Save'}>
              <svg className="w-4 h-4" fill={isSaved || justSaved ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </button>
          )}
          {process.managed && (
            <button onClick={() => onShowLogs(process.pid)}
              className="p-1.5 rounded-md hover:bg-dark-700 text-dark-400 hover:text-white transition-colors" title="Terminal">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
          )}
          <button onClick={handleStop} disabled={stopping}
            className="p-1.5 rounded-md hover:bg-red-500/20 text-dark-400 hover:text-red-400 transition-colors disabled:opacity-50" title="Stop All">
            {stopping ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Ports - per-port controls */}
      {process.ports.length > 0 ? (
        <div className="mb-3 space-y-1.5">
          {process.portDetails?.map(({ port, pid }) => (
            <div key={port} className="flex items-center gap-2 bg-blue-500/10 rounded-lg px-2.5 py-1.5">
              <a
                href={`http://localhost:${port}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 flex-1 min-w-0 text-blue-400 hover:text-blue-300 transition-colors"
              >
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
                </svg>
                <span className="text-xs font-mono truncate">localhost:{port}</span>
                <svg className="w-3 h-3 flex-shrink-0 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
              <button
                onClick={() => handleStopPort(port)}
                disabled={stoppingPort === port}
                className="p-1 rounded hover:bg-red-500/20 text-dark-500 hover:text-red-400 transition-colors flex-shrink-0"
                title={`Stop port ${port}`}
              >
                {stoppingPort === port ? (
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="7" y="7" width="10" height="10" rx="1.5" />
                  </svg>
                )}
              </button>
            </div>
          )) || process.ports.map(port => (
            <a key={port} href={`http://localhost:${port}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-2.5 py-1.5 bg-blue-500/10 text-blue-400 text-xs rounded-lg hover:bg-blue-500/20 transition-colors">
              <span className="font-mono">localhost:{port}</span>
            </a>
          ))}
        </div>
      ) : (
        <div className="mb-3 px-2.5 py-1.5 bg-dark-700/30 rounded-lg">
          <span className="text-dark-500 text-xs">No listening ports</span>
        </div>
      )}

      {/* CPU/MEM */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-dark-900/50 rounded-lg px-2.5 py-1.5">
          <span className="text-dark-400">CPU</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className="flex-1 h-1 bg-dark-700 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${Math.min(process.cpu, 100)}%` }} />
            </div>
            <span className="text-amber-400 font-medium w-10 text-right">{process.cpu}%</span>
          </div>
        </div>
        <div className="bg-dark-900/50 rounded-lg px-2.5 py-1.5">
          <span className="text-dark-400">MEM</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className="flex-1 h-1 bg-dark-700 rounded-full overflow-hidden">
              <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${Math.min(process.mem, 100)}%` }} />
            </div>
            <span className="text-purple-400 font-medium w-10 text-right">{process.mem}%</span>
          </div>
        </div>
      </div>

      {/* Command & Dir */}
      <div className="mt-3 pt-3 border-t border-dark-700/50">
        <code className="text-[11px] text-dark-400 block truncate" title={process.command}>{shortCmd}</code>
        {process.projectDir && (
          <span className="text-[10px] text-dark-500 block mt-0.5 truncate" title={process.projectDir}>{process.projectDir}</span>
        )}
      </div>
    </div>
  );
}
