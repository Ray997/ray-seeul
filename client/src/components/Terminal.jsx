import { useEffect, useRef } from 'react';

export default function Terminal({ logs, pid, onClose }) {
  const containerRef = useRef(null);
  const autoScrollRef = useRef(true);

  useEffect(() => {
    if (autoScrollRef.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 50;
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 fade-in">
      <div className="bg-dark-800 border border-dark-700 rounded-xl w-full max-w-4xl max-h-[80vh] flex flex-col shadow-2xl">
        {/* Terminal Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-dark-700 bg-dark-900/50 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <button
                onClick={onClose}
                className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400 transition-colors"
              />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
            </div>
            <span className="text-xs text-dark-400 font-medium">
              Terminal - PID {pid}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-dark-400 hover:text-white transition-colors p-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Terminal Content */}
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-auto p-4 bg-dark-900 terminal-output min-h-[300px]"
        >
          {(!logs || logs.length === 0) ? (
            <div className="text-dark-500 text-center py-8">
              Henuz log yok...
            </div>
          ) : (
            logs.map((log, i) => (
              <div
                key={i}
                className={`${log.type === 'stderr' ? 'text-red-400' : 'text-dark-200'} leading-relaxed`}
              >
                <span className="text-dark-600 select-none mr-2">
                  {new Date(log.time).toLocaleTimeString('tr-TR')}
                </span>
                {log.text}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
