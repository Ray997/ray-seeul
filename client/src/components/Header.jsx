import { useState, useEffect } from 'react';

export default function Header({ processes, connected, onOpenStartDialog, onRefresh }) {
  const [time, setTime] = useState(new Date());
  const [spinning, setSpinning] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleRefresh = () => {
    setSpinning(true);
    onRefresh();
    setTimeout(() => setSpinning(false), 800);
  };

  const totalPorts = processes.reduce((acc, p) => acc + p.ports.length, 0);
  const totalCpu = processes.reduce((acc, p) => acc + p.cpu, 0).toFixed(1);
  const totalMem = processes.reduce((acc, p) => acc + p.mem, 0).toFixed(1);

  return (
    <header className="bg-dark-800/80 backdrop-blur-sm border-b border-dark-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-emerald-500/20">
              RS
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white leading-tight">Ray Seeul</h1>
              <p className="text-[11px] text-dark-400">Node.js Process Manager</p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-6">
            <Stat label="Processes" value={processes.length} color="emerald" />
            <Stat label="Ports" value={totalPorts} color="blue" />
            <Stat label="CPU" value={`${totalCpu}%`} color="amber" />
            <Stat label="MEM" value={`${totalMem}%`} color="purple" />
          </div>

          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${
              connected ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 pulse-green' : 'bg-red-400'}`} />
              {connected ? 'Live' : 'Offline'}
            </div>
            <span className="text-xs text-dark-400 hidden md:block">
              {time.toLocaleTimeString()}
            </span>
            <button
              onClick={handleRefresh}
              className="p-2 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-white transition-colors"
              title="Refresh"
            >
              <svg className={`w-4 h-4 transition-transform ${spinning ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              onClick={onOpenStartDialog}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-all hover:shadow-lg hover:shadow-emerald-600/20 active:scale-95 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">New Process</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

function Stat({ label, value, color }) {
  const colors = {
    emerald: 'text-emerald-400',
    blue: 'text-blue-400',
    amber: 'text-amber-400',
    purple: 'text-purple-400',
  };
  return (
    <div className="text-center">
      <div className={`text-lg font-semibold ${colors[color]}`}>{value}</div>
      <div className="text-[10px] text-dark-400 uppercase tracking-wider">{label}</div>
    </div>
  );
}
