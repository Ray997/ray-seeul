import { useState } from 'react';

export default function SavedCard({ project, onStart, onRemove }) {
  const [starting, setStarting] = useState(false);

  const handleStart = async () => {
    setStarting(true);
    try {
      await onStart({ dir: project.dir, command: project.command, port: project.port });
    } finally {
      setTimeout(() => setStarting(false), 3000);
    }
  };

  return (
    <div className="bg-dark-800/60 border border-dark-700/50 border-dashed rounded-xl p-4 fade-in group">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-2.5 h-2.5 rounded-full bg-dark-500 flex-shrink-0" />
          <div className="min-w-0">
            <h3 className="text-dark-300 font-semibold text-sm truncate">
              {project.name}
            </h3>
            <span className="text-dark-500 text-[11px]">Durdurulmus</span>
          </div>
        </div>
        <button
          onClick={() => onRemove(project.dir)}
          className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-dark-700 text-dark-500 hover:text-red-400 transition-all"
          title="Kaydi Sil"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Port info */}
      {project.port && (
        <div className="mb-3">
          <div className="flex items-center gap-2 px-2.5 py-1.5 bg-dark-700/30 text-dark-500 text-xs rounded-lg">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
            </svg>
            <span className="font-mono">Port {project.port} - aktif degil</span>
          </div>
        </div>
      )}

      {/* Command */}
      <code className="text-[11px] text-dark-500 block truncate mb-3" title={project.command}>
        {project.command}
      </code>
      <span className="text-[10px] text-dark-600 block truncate mb-3" title={project.dir}>
        {project.dir}
      </span>

      {/* Start Button */}
      <button
        onClick={handleStart}
        disabled={starting}
        className="w-full py-2 px-3 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 text-sm font-medium transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {starting ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Baslatiliyor...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Baslat
          </>
        )}
      </button>
    </div>
  );
}
