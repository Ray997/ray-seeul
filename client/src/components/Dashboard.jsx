import ProcessCard from './ProcessCard.jsx';
import SavedCard from './SavedCard.jsx';

export default function Dashboard({ processes, saved, startingDirs, onStop, onStopPort, onShowLogs, onSave, onStart, onRemoveSaved }) {
  // Show saved projects that are stopped OR currently starting up
  const stoppedSaved = saved.filter(s => !s.running || startingDirs?.has(s.dir));
  const savedDirs = new Set(saved.map(s => s.dir));

  const hasActive = processes.length > 0;
  const hasStopped = stoppedSaved.length > 0;

  if (!hasActive && !hasStopped) {
    return (
      <div className="flex flex-col items-center justify-center py-20 fade-in">
        <div className="w-20 h-20 bg-dark-800 rounded-2xl flex items-center justify-center mb-4 border border-dark-700">
          <svg className="w-10 h-10 text-dark-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 className="text-dark-300 font-medium text-lg mb-1">No Running Node.js Processes</h3>
        <p className="text-dark-500 text-sm">
          Use the button in the top right to start a new project
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {hasActive && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <h2 className="text-sm font-medium text-dark-300 uppercase tracking-wider">
              Active Processes ({processes.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {processes.map(proc => (
              <ProcessCard
                key={proc.pid}
                process={proc}
                isSaved={savedDirs.has(proc.projectDir) || savedDirs.has(proc.cwd)}
                onStop={onStop}
                onStopPort={onStopPort}
                onShowLogs={onShowLogs}
                onSave={onSave}
                onRemoveSaved={onRemoveSaved}
              />
            ))}
          </div>
        </section>
      )}

      {hasStopped && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-dark-500" />
            <h2 className="text-sm font-medium text-dark-300 uppercase tracking-wider">
              Saved - Stopped ({stoppedSaved.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stoppedSaved.map(proj => (
              <SavedCard
                key={proj.dir}
                project={proj}
                isStarting={startingDirs?.has(proj.dir)}
                onStart={onStart}
                onRemove={onRemoveSaved}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
