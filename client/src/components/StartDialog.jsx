import { useState, useEffect } from 'react';

export default function StartDialog({ onClose, onStart }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDir, setSelectedDir] = useState('');
  const [customDir, setCustomDir] = useState('');
  const [command, setCommand] = useState('npm run dev');
  const [port, setPort] = useState('');
  const [starting, setStarting] = useState(false);
  const [search, setSearch] = useState('');
  const [newScanDir, setNewScanDir] = useState('');

  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then(data => {
        setProjects(data.projects || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleStart = async () => {
    const dir = selectedDir || customDir;
    if (!dir || !command) return;
    setStarting(true);
    try {
      await onStart({ dir, command, port: port ? parseInt(port) : undefined });
      onClose();
    } catch { setStarting(false); }
  };

  const handleAddScanDir = async () => {
    if (!newScanDir) return;
    try {
      await fetch('/api/scan-dirs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dir: newScanDir })
      });
      setNewScanDir('');
      // Re-fetch projects
      setLoading(true);
      const res = await fetch('/api/projects');
      const data = await res.json();
      setProjects(data.projects || []);
      setLoading(false);
    } catch { /* skip */ }
  };

  const filteredProjects = projects.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.dir.toLowerCase().includes(search.toLowerCase())
  );

  const quickCommands = ['npm run dev', 'npm start', 'node index.js', 'node server.js', 'npx tsx src/index.ts'];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 fade-in">
      <div className="bg-dark-800 border border-dark-700 rounded-xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-dark-700 sticky top-0 bg-dark-800 z-10">
          <h2 className="text-white font-semibold">Start New Process</h2>
          <button onClick={onClose} className="text-dark-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Project Selection */}
          <div>
            <label className="text-sm text-dark-300 font-medium block mb-2">Project Directory</label>
            <input
              type="text"
              placeholder="Search projects..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white placeholder-dark-500 focus:outline-none focus:border-emerald-500 mb-2"
            />

            <div className="max-h-48 overflow-y-auto bg-dark-900 rounded-lg border border-dark-600">
              {loading ? (
                <div className="p-3 text-center text-dark-500 text-sm">Scanning projects...</div>
              ) : filteredProjects.length === 0 ? (
                <div className="p-3 text-center text-dark-500 text-sm">No projects found</div>
              ) : (
                filteredProjects.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setSelectedDir(p.dir);
                      setCustomDir('');
                      if (p.scripts?.includes('dev')) setCommand('npm run dev');
                      else if (p.scripts?.includes('start')) setCommand('npm start');
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-dark-700 transition-colors border-b border-dark-700/50 last:border-0 ${
                      selectedDir === p.dir ? 'bg-emerald-500/10 text-emerald-400' : 'text-dark-200'
                    }`}
                  >
                    <div className="font-medium">{p.name}</div>
                    <div className="text-[11px] text-dark-500 truncate">{p.dir}</div>
                    {p.scripts?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {p.scripts.slice(0, 6).map(s => (
                          <span key={s} className="text-[10px] px-1.5 py-0.5 bg-dark-700 text-dark-400 rounded">{s}</span>
                        ))}
                        {p.scripts.length > 6 && <span className="text-[10px] text-dark-500">+{p.scripts.length - 6}</span>}
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>

            {/* Add Scan Directory */}
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                placeholder="Add scan directory: /path/to/folder"
                value={newScanDir}
                onChange={e => setNewScanDir(e.target.value)}
                className="flex-1 bg-dark-900 border border-dark-600 rounded-lg px-3 py-1.5 text-xs text-white placeholder-dark-500 focus:outline-none focus:border-cyan-500"
              />
              <button
                onClick={handleAddScanDir}
                disabled={!newScanDir}
                className="px-3 py-1.5 bg-cyan-600/20 text-cyan-400 text-xs rounded-lg hover:bg-cyan-600/30 disabled:opacity-30 transition-colors"
              >
                Add
              </button>
            </div>

            {/* Custom Dir */}
            <div className="mt-2">
              <input
                type="text"
                placeholder="Or enter full project path: /path/to/project"
                value={customDir}
                onChange={e => { setCustomDir(e.target.value); setSelectedDir(''); }}
                className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white placeholder-dark-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Command */}
          <div>
            <label className="text-sm text-dark-300 font-medium block mb-2">Start Command</label>
            <input
              type="text"
              value={command}
              onChange={e => setCommand(e.target.value)}
              className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder-dark-500 focus:outline-none focus:border-emerald-500"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {quickCommands.map(cmd => (
                <button
                  key={cmd}
                  onClick={() => setCommand(cmd)}
                  className={`text-[11px] px-2 py-1 rounded-md transition-colors ${
                    command === cmd ? 'bg-emerald-500/20 text-emerald-400' : 'bg-dark-700 text-dark-400 hover:text-dark-200'
                  }`}
                >
                  {cmd}
                </button>
              ))}
            </div>
          </div>

          {/* Port */}
          <div>
            <label className="text-sm text-dark-300 font-medium block mb-2">
              Port <span className="text-dark-500 font-normal">(optional)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="3000"
                value={port}
                onChange={e => setPort(e.target.value)}
                className="flex-1 bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white placeholder-dark-500 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await fetch('/api/port/free');
                    const { port: freePort } = await res.json();
                    setPort(String(freePort));
                  } catch { /* skip */ }
                }}
                className="px-3 py-2 bg-cyan-600/20 text-cyan-400 text-xs rounded-lg hover:bg-cyan-600/30 transition-colors whitespace-nowrap"
              >
                Auto Free Port
              </button>
            </div>
          </div>

          {/* Summary */}
          {(selectedDir || customDir) && (
            <div className="bg-dark-900/50 rounded-lg p-3 border border-dark-700/50">
              <div className="text-[11px] text-dark-500 uppercase tracking-wider mb-1">Summary</div>
              <code className="text-xs text-emerald-400 block">
                cd {selectedDir || customDir} && {port ? `PORT=${port} ` : ''}{command}
              </code>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-dark-700 flex justify-end gap-3 sticky bottom-0 bg-dark-800">
          <button onClick={onClose} className="px-4 py-2 text-sm text-dark-400 hover:text-white transition-colors">
            Cancel
          </button>
          <button
            onClick={handleStart}
            disabled={starting || (!selectedDir && !customDir) || !command}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-dark-600 disabled:text-dark-400 text-white text-sm font-medium px-5 py-2 rounded-lg transition-all active:scale-95 flex items-center gap-2"
          >
            {starting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Starting...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Start
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
