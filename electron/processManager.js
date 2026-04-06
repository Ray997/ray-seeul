const { execSync, spawn } = require('child_process');
const { readFileSync, writeFileSync, existsSync, readdirSync, statSync, readlinkSync } = require('fs');
const { join, basename } = require('path');
const { homedir, platform } = require('os');
const { createServer: createNetServer } = require('net');

const PLATFORM = platform(); // 'darwin', 'linux', 'win32'
const managedProcesses = new Map();
const SAVED_FILE = join(__dirname, 'saved-projects.json');

// ─── Cross-platform helpers ───

function exec(cmd, timeout = 5000) {
  try {
    return execSync(cmd, {
      encoding: 'utf-8',
      timeout,
      windowsHide: true,
      env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${process.env.PATH || ''}` }
    }).trim();
  } catch { return ''; }
}

// ─── Process listing ───

function getAllProcesses() {
  if (PLATFORM === 'win32') return getProcessesWindows();
  return getProcessesUnix();
}

function getProcessesUnix() {
  const out = exec('ps -eo pid,ppid,pcpu,pmem,command');
  if (!out) return [];
  return out.split('\n').slice(1).map(line => {
    const m = line.match(/^\s*(\d+)\s+(\d+)\s+([\d.]+)\s+([\d.]+)\s+(.+)$/);
    if (!m) return null;
    return { pid: +m[1], ppid: +m[2], cpu: +m[3], mem: +m[4], command: m[5].trim() };
  }).filter(Boolean);
}

function getProcessesWindows() {
  // Use wmic for detailed process info
  const out = exec('wmic process get ProcessId,ParentProcessId,CommandLine,WorkingSetSize /format:csv', 10000);
  if (!out) return [];
  const lines = out.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  // Get CPU from tasklist (wmic doesn't give CPU%)
  const cpuMap = new Map();
  const taskOut = exec('wmic path Win32_PerfFormattedData_PerfProc_Process get IDProcess,PercentProcessorTime /format:csv', 10000);
  if (taskOut) {
    for (const line of taskOut.split('\n').slice(1)) {
      const parts = line.trim().split(',');
      if (parts.length >= 3) cpuMap.set(+parts[1], +parts[2] || 0);
    }
  }

  return lines.slice(1).map(line => {
    const parts = line.trim().split(',');
    if (parts.length < 5) return null;
    // CSV: Node,CommandLine,ParentProcessId,ProcessId,WorkingSetSize
    const cmd = parts[1] || '';
    const ppid = +parts[2] || 0;
    const pid = +parts[3] || 0;
    const memBytes = +parts[4] || 0;
    if (!pid) return null;
    return {
      pid, ppid,
      cpu: cpuMap.get(pid) || 0,
      mem: Math.round(memBytes / 1024 / 1024 / 10) / 10, // rough % of 10GB
      command: cmd
    };
  }).filter(Boolean);
}

// ─── Port detection ───

function getAllListeningPorts() {
  const portByPid = new Map(); // pid -> [{port, pid}]

  if (PLATFORM === 'win32') {
    const out = exec('netstat -ano | findstr LISTENING', 10000);
    if (out) {
      for (const line of out.split('\n')) {
        const m = line.match(/TCP\s+[\d.:]+:(\d+)\s+.*LISTENING\s+(\d+)/);
        if (!m) continue;
        const port = +m[1], pid = +m[2];
        if (!portByPid.has(pid)) portByPid.set(pid, []);
        const arr = portByPid.get(pid);
        if (!arr.some(e => e.port === port)) arr.push({ port, pid });
      }
    }
  } else if (PLATFORM === 'linux') {
    // Try ss first, fall back to lsof
    let out = exec('ss -tlnp 2>/dev/null');
    if (out) {
      for (const line of out.split('\n').slice(1)) {
        const portM = line.match(/:(\d+)\s/);
        const pidM = line.match(/pid=(\d+)/);
        if (!portM || !pidM) continue;
        const port = +portM[1], pid = +pidM[1];
        if (!portByPid.has(pid)) portByPid.set(pid, []);
        const arr = portByPid.get(pid);
        if (!arr.some(e => e.port === port)) arr.push({ port, pid });
      }
    } else {
      out = exec('lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null');
      if (out) parseLsofPorts(out, portByPid);
    }
  } else {
    // macOS
    const out = exec('lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null');
    if (out) parseLsofPorts(out, portByPid);
  }

  return portByPid;
}

function parseLsofPorts(out, portByPid) {
  for (const line of out.split('\n').slice(1)) {
    const pidMatch = line.match(/^\S+\s+(\d+)/);
    const portMatch = line.match(/[*:](\d+)\s+\(LISTEN\)/);
    if (!pidMatch || !portMatch) continue;
    const pid = +pidMatch[1], port = +portMatch[1];
    if (!portByPid.has(pid)) portByPid.set(pid, []);
    const arr = portByPid.get(pid);
    if (!arr.some(e => e.port === port)) arr.push({ port, pid });
  }
}

// ─── CWD detection ───

function getProcessCwd(pid) {
  if (PLATFORM === 'linux') {
    try {
      return readlinkSync(`/proc/${pid}/cwd`);
    } catch { return null; }
  }

  if (PLATFORM === 'darwin') {
    const out = exec(`lsof -a -d cwd -p ${pid} 2>/dev/null | tail -1`);
    if (out) {
      const m = out.match(/DIR\s+\S+\s+\S+\s+\S+\s+(.+)$/);
      if (m && m[1].trim() !== '/') return m[1].trim();
    }
    return null;
  }

  if (PLATFORM === 'win32') {
    // Windows: try wmic to get ExecutablePath, derive cwd from it
    const out = exec(`wmic process where ProcessId=${pid} get ExecutablePath /format:csv`);
    if (out) {
      const lines = out.split('\n').filter(l => l.trim());
      if (lines.length >= 2) {
        const path = lines[1].split(',')[1]?.trim();
        if (path) return join(path, '..');
      }
    }
    return null;
  }

  return null;
}

// ─── Parent PID ───

function getParentPid(pid) {
  if (PLATFORM === 'win32') {
    const out = exec(`wmic process where ProcessId=${pid} get ParentProcessId /format:csv`);
    if (out) {
      const lines = out.split('\n').filter(l => l.trim());
      if (lines.length >= 2) return +lines[1].split(',')[1]?.trim() || 0;
    }
    return 0;
  }
  const out = exec(`ps -o ppid= -p ${pid}`);
  return +out || 0;
}

// ─── Project scanning ───

function scanDir(dir, maxDepth, results, seen) {
  if (maxDepth < 0 || !existsSync(dir)) return;
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name.startsWith('.')) continue;
      const fullPath = join(dir, entry.name);
      if (entry.name === 'package.json' && entry.isFile()) {
        if (seen.has(dir)) continue;
        seen.add(dir);
        try {
          const pkg = JSON.parse(readFileSync(fullPath, 'utf-8'));
          results.push({
            name: pkg.name || basename(dir),
            dir,
            scripts: pkg.scripts ? Object.keys(pkg.scripts) : [],
            hasStartScript: !!(pkg.scripts?.start || pkg.scripts?.dev),
            description: pkg.description || null
          });
        } catch { /* skip */ }
      } else if (entry.isDirectory() && maxDepth > 0) {
        scanDir(fullPath, maxDepth - 1, results, seen);
      }
    }
  } catch { /* skip */ }
}

// ─── Known app detection ───

function detectKnownApp(command) {
  const lower = command.toLowerCase();
  if (lower.includes('lmstudio') || lower.includes('lm studio') || lower.includes('.lmstudio')) return 'LM Studio';
  if (lower.includes('claude.app') || lower.includes('claude.exe')) return 'Claude Desktop';
  if (lower.includes('cursor.app') || lower.includes('cursor.exe')) return 'Cursor';
  if (lower.includes('visual studio code') || lower.includes('code.exe') || lower.includes('code-server')) return 'VS Code';
  // macOS/Linux .app detection
  const appMatch = command.match(/\/([^/]+)\.app\//);
  if (appMatch && !['Helpers', 'Contents'].includes(appMatch[1])) return appMatch[1];
  return null;
}

function extractProjectDir(command) {
  const nmIdx = command.indexOf('/node_modules/');
  const nmIdxWin = command.indexOf('\\node_modules\\');
  const idx = nmIdx > 0 ? nmIdx : nmIdxWin > 0 ? nmIdxWin : -1;
  if (idx > 0) {
    const before = command.substring(0, idx);
    const pathStart = before.search(/[/\\](?:Users|home|opt|var|tmp|srv|app|[A-Z]:)/i);
    if (pathStart >= 0) return command.substring(pathStart, idx);
  }
  const fileMatch = command.match(/\bnode(?:\.exe)?\s+(?:--\S+\s+)*([/\\].+?\.[jt]sx?)\b/);
  if (fileMatch) return join(fileMatch[1], '..');
  return null;
}

function extractNameFromCommand(command) {
  const parts = command.split(/\s+/);
  const ni = parts.findIndex(p => p.endsWith('/node') || p.endsWith('\\node.exe') || p === 'node' || p === 'node.exe');
  if (ni >= 0) {
    for (let i = ni + 1; i < parts.length; i++) {
      if (!parts[i].startsWith('-')) {
        return basename(parts[i]).replace(/\.(js|ts|mjs|cjs)$/, '');
      }
    }
  }
  return command.substring(0, 40);
}

function findPackageJson(dir) {
  let current = dir;
  for (let i = 0; i < 5; i++) {
    const p = join(current, 'package.json');
    if (existsSync(p)) return p;
    const parent = join(current, '..');
    if (parent === current) break;
    current = parent;
  }
  return null;
}

// ─── Saved Projects ───

function loadSaved() {
  try {
    if (existsSync(SAVED_FILE)) return JSON.parse(readFileSync(SAVED_FILE, 'utf-8'));
  } catch { /* skip */ }
  return { projects: [], customScanDirs: [] };
}

function writeSaved(data) {
  writeFileSync(SAVED_FILE, JSON.stringify(data, null, 2));
}

// ─── Exports ───

function getRunningNodeProcesses() {
  try {
    const allProcs = getAllProcesses();
    const isNodeCmd = (cmd) => {
      const c = cmd.toLowerCase();
      return /(?:^|[/\\])node(?:\.exe)?\s|(?:^|[/\\])node(?:\.exe)?$|[/\\]tsx\s|[/\\]ts-node\s/.test(c);
    };

    const nodeProcs = allProcs.filter(p => {
      if (!isNodeCmd(p.command)) return false;
      if (p.pid === process.pid) return false;
      const cl = p.command.toLowerCase();
      if (cl.includes('ray_seeul') || cl.includes('ray-seeul')) return false;
      // Skip our own Electron process specifically (not all Electron apps)
      if (cl.includes('ray seeul') || cl.includes('rayseeul')) return false;
      if (cl.includes('/disclaimer ')) return false;
      return true;
    });

    // Exclude our own process tree
    const myPids = new Set([process.pid]);
    const ppid = getParentPid(process.pid);
    if (ppid) {
      myPids.add(ppid);
      const gppid = getParentPid(ppid);
      if (gppid) myPids.add(gppid);
    }
    let changed = true;
    while (changed) {
      changed = false;
      for (const p of allProcs) {
        if (!myPids.has(p.pid) && myPids.has(p.ppid)) { myPids.add(p.pid); changed = true; }
      }
    }

    const external = nodeProcs.filter(p => !myPids.has(p.pid));

    // Group parent-child
    const extPids = new Set(external.map(p => p.pid));
    const parents = [];
    const childMap = new Map();
    for (const p of external) {
      if (extPids.has(p.ppid)) {
        if (!childMap.has(p.ppid)) childMap.set(p.ppid, []);
        childMap.get(p.ppid).push(p);
      } else {
        parents.push(p);
      }
    }

    // Port map
    const portByPid = getAllListeningPorts();

    // Build results
    const results = [];
    for (const proc of parents) {
      const children = childMap.get(proc.pid) || [];
      const allPids = [proc.pid, proc.ppid, ...children.map(c => c.pid)];
      const totalCpu = Math.round((proc.cpu + children.reduce((s, c) => s + c.cpu, 0)) * 10) / 10;
      const totalMem = Math.round((proc.mem + children.reduce((s, c) => s + c.mem, 0)) * 10) / 10;

      const info = {
        pid: proc.pid,
        childPids: children.map(c => c.pid),
        cpu: totalCpu,
        mem: totalMem,
        command: proc.command,
        ports: [],
        portDetails: [],
        cwd: null,
        projectName: null,
        projectDir: null,
        managed: managedProcesses.has(proc.pid),
        status: 'running'
      };

      info.projectName = detectKnownApp(proc.command);

      // Ports from all related PIDs
      const portSet = new Set();
      const portDetails = [];
      for (const pid of allPids) {
        for (const e of (portByPid.get(pid) || [])) {
          if (!portSet.has(e.port)) {
            portSet.add(e.port);
            portDetails.push({ port: e.port, pid: e.pid });
          }
        }
      }
      info.ports = [...portSet].sort((a, b) => a - b);
      info.portDetails = portDetails.sort((a, b) => a.port - b.port);

      // CWD & project detection
      if (!info.projectName) {
        info.cwd = getProcessCwd(proc.pid);
        const dir = info.cwd || extractProjectDir(proc.command);
        if (dir && dir !== '/' && dir !== 'C:\\') {
          info.projectDir = dir;
          const pkgPath = findPackageJson(dir);
          if (pkgPath) {
            try {
              const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
              info.projectName = pkg.name || basename(join(pkgPath, '..'));
              info.projectDir = join(pkgPath, '..');
            } catch { /* skip */ }
          }
          if (!info.projectName) info.projectName = basename(dir);
        }
      }

      if (!info.projectName) info.projectName = extractNameFromCommand(proc.command);
      if (info.projectDir?.includes('ray_seeul') || info.projectDir?.includes('ray-seeul')) continue;

      results.push(info);
    }
    // Add managed processes not caught by ps scan
    const resultPids = new Set(results.map(r => r.pid));
    for (const [pid, managed] of managedProcesses) {
      if (managed.status === 'stopped' || resultPids.has(pid)) continue;
      const info = {
        pid,
        childPids: [],
        cpu: 0, mem: 0,
        command: managed.command,
        ports: [],
        portDetails: [],
        cwd: managed.dir,
        projectName: basename(managed.dir),
        projectDir: managed.dir,
        managed: true,
        status: managed.status || 'running'
      };
      // Check ports for managed process children
      for (const [p, entries] of portByPid) {
        if (allProcs.some(proc => proc.pid === p && isChildOf(allProcs, p, pid))) {
          for (const e of entries) {
            if (!info.ports.includes(e.port)) {
              info.ports.push(e.port);
              info.portDetails.push(e);
            }
          }
        }
      }
      const pkgPath = findPackageJson(managed.dir);
      if (pkgPath) {
        try { info.projectName = JSON.parse(readFileSync(pkgPath, 'utf-8')).name || info.projectName; } catch {}
      }
      if (!info.projectDir?.includes('ray_seeul')) results.push(info);
    }

    return results;
  } catch (e) {
    console.error('Process scan error:', e.message);
    return [];
  }
}

function scanKnownProjects() {
  const projects = [];
  const home = homedir();
  const defaultDirs = ['projects', 'dev', 'workspace', 'code', 'repos', 'Desktop', 'Documents'];
  const { customScanDirs } = loadSaved();
  const allDirs = [...defaultDirs.map(d => join(home, d)), ...(customScanDirs || [])];
  const seen = new Set();

  for (const dir of allDirs) {
    scanDir(dir, 3, projects, seen);
  }
  return projects;
}

function startProcess({ dir, command, port, env = {} }) {
  const processEnv = { ...process.env, ...env };
  // Add common node paths
  if (PLATFORM !== 'win32') {
    processEnv.PATH = `/opt/homebrew/bin:/usr/local/bin:${processEnv.PATH || ''}`;
  }
  if (port) processEnv.PORT = String(port);

  const child = spawn(command, {
    cwd: dir, env: processEnv, shell: true, detached: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });

  const logs = [];
  child.stdout.on('data', d => {
    logs.push({ type: 'stdout', text: d.toString(), time: Date.now() });
    if (logs.length > 500) logs.shift();
  });
  child.stderr.on('data', d => {
    logs.push({ type: 'stderr', text: d.toString(), time: Date.now() });
    if (logs.length > 500) logs.shift();
  });
  child.on('exit', code => {
    const e = managedProcesses.get(child.pid);
    if (e) { e.status = 'stopped'; e.exitCode = code; }
  });

  managedProcesses.set(child.pid, {
    pid: child.pid, child, dir, command, port, logs, status: 'running', startedAt: Date.now()
  });
  return { pid: child.pid, status: 'started' };
}

function stopProcess(pid) {
  const n = parseInt(pid);
  const managed = managedProcesses.get(n);
  if (managed?.child) {
    try {
      if (PLATFORM === 'win32') {
        exec(`taskkill /PID ${n} /T /F`);
      } else {
        managed.child.kill('SIGTERM');
        setTimeout(() => { try { managed.child.kill('SIGKILL'); } catch {} }, 3000);
      }
      managed.status = 'stopping';
      return { success: true, message: `Process ${n} stopping` };
    } catch (e) { return { success: false, message: e.message }; }
  }
  try {
    if (PLATFORM === 'win32') {
      exec(`taskkill /PID ${n} /T /F`);
    } else {
      process.kill(n, 'SIGTERM');
    }
    return { success: true, message: `Signal sent to ${n}` };
  } catch (e) { return { success: false, message: e.message }; }
}

function stopPortProcess(port) {
  if (PLATFORM === 'win32') {
    const out = exec(`netstat -ano | findstr :${port} | findstr LISTENING`);
    if (!out) return { success: false, message: `No process on port ${port}` };
    const pids = new Set();
    for (const line of out.split('\n')) {
      const m = line.match(/LISTENING\s+(\d+)/);
      if (m) pids.add(+m[1]);
    }
    for (const pid of pids) exec(`taskkill /PID ${pid} /T /F`);
    return { success: true, message: `Stopped ${pids.size} process(es) on port ${port}` };
  }

  const out = PLATFORM === 'darwin'
    ? exec(`lsof -a -iTCP:${port} -sTCP:LISTEN -P -n -t 2>/dev/null`)
    : exec(`lsof -iTCP:${port} -sTCP:LISTEN -t 2>/dev/null || ss -tlnp | grep :${port} | grep -oP 'pid=\\K\\d+'`);

  if (!out) return { success: false, message: `No process on port ${port}` };
  const pids = out.split('\n').map(p => +p.trim()).filter(Boolean);
  for (const pid of pids) { try { process.kill(pid, 'SIGTERM'); } catch {} }
  return { success: true, message: `Stopped ${pids.length} process(es) on port ${port}`, pids };
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = createNetServer();
    srv.listen(0, () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

function isPortInUse(port) {
  if (PLATFORM === 'win32') {
    const out = exec(`netstat -ano | findstr :${port} | findstr LISTENING`);
    return !!out;
  }
  const out = PLATFORM === 'darwin'
    ? exec(`lsof -iTCP:${port} -sTCP:LISTEN -P -n 2>/dev/null`)
    : exec(`ss -tlnp | grep :${port} 2>/dev/null || lsof -iTCP:${port} -sTCP:LISTEN 2>/dev/null`);
  return out.split('\n').length > 1;
}

function getSavedProjects() { return loadSaved(); }

function saveProject({ name, dir, command, port }) {
  const data = loadSaved();
  const idx = data.projects.findIndex(p => p.dir === dir);
  const entry = { name, dir, command, port: port || null, savedAt: Date.now() };
  if (idx >= 0) data.projects[idx] = entry; else data.projects.push(entry);
  writeSaved(data);
  return entry;
}

function removeSavedProject(dir) {
  const data = loadSaved();
  data.projects = data.projects.filter(p => p.dir !== dir);
  writeSaved(data);
}

function addCustomScanDir(dir) {
  const data = loadSaved();
  if (!data.customScanDirs) data.customScanDirs = [];
  if (!data.customScanDirs.includes(dir)) { data.customScanDirs.push(dir); writeSaved(data); }
  return data.customScanDirs;
}

function getSavedWithStatus() {
  const { projects } = loadSaved();
  return projects.map(p => ({ ...p, running: p.port ? isPortInUse(p.port) : false }));
}

function getProcessLogs(pid) {
  return managedProcesses.get(parseInt(pid))?.logs || [];
}

function isChildOf(allProcs, childPid, parentPid) {
  let current = childPid;
  for (let i = 0; i < 10; i++) {
    const proc = allProcs.find(p => p.pid === current);
    if (!proc) return false;
    if (proc.ppid === parentPid) return true;
    current = proc.ppid;
  }
  return false;
}

module.exports = {
  getRunningNodeProcesses,
  scanKnownProjects,
  startProcess,
  stopProcess,
  stopPortProcess,
  findFreePort,
  getProcessLogs,
  getSavedProjects,
  saveProject,
  removeSavedProject,
  addCustomScanDir,
  getSavedWithStatus,
  isPortInUse
};
