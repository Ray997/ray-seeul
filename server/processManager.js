import { execSync, spawn } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';
import { createServer as createNetServer } from 'net';

const managedProcesses = new Map();
const SERVER_DIR = new URL('.', import.meta.url).pathname.replace(/\/$/, '');
const SAVED_FILE = join(SERVER_DIR, 'saved-projects.json');

// --- Saved Projects ---

function loadSaved() {
  try {
    if (existsSync(SAVED_FILE)) return JSON.parse(readFileSync(SAVED_FILE, 'utf-8'));
  } catch { /* skip */ }
  return { projects: [], customScanDirs: [] };
}

function writeSaved(data) {
  writeFileSync(SAVED_FILE, JSON.stringify(data, null, 2));
}

export function getSavedProjects() {
  return loadSaved();
}

export function saveProject({ name, dir, command, port }) {
  const data = loadSaved();
  const existing = data.projects.findIndex(p => p.dir === dir);
  const entry = { name, dir, command, port: port || null, savedAt: Date.now() };
  if (existing >= 0) data.projects[existing] = entry;
  else data.projects.push(entry);
  writeSaved(data);
  return entry;
}

export function removeSavedProject(dir) {
  const data = loadSaved();
  data.projects = data.projects.filter(p => p.dir !== dir);
  writeSaved(data);
}

export function addCustomScanDir(dir) {
  const data = loadSaved();
  if (!data.customScanDirs) data.customScanDirs = [];
  if (!data.customScanDirs.includes(dir)) {
    data.customScanDirs.push(dir);
    writeSaved(data);
  }
  return data.customScanDirs;
}

export function isPortInUse(port) {
  try {
    const out = execSync(`lsof -iTCP:${port} -sTCP:LISTEN -P -n 2>/dev/null`, {
      encoding: 'utf-8', timeout: 2000
    }).trim();
    return out.split('\n').length > 1; // header + at least one line
  } catch { return false; }
}

export function getSavedWithStatus() {
  const { projects } = loadSaved();
  return projects.map(p => {
    let running = false;
    if (p.port) {
      running = isPortInUse(p.port);
    }
    return { ...p, running };
  });
}

export function getRunningNodeProcesses() {
  try {
    // Step 1: Get all processes with node binary
    const psOutput = execSync(
      `ps -eo pid,ppid,pcpu,pmem,command`,
      { encoding: 'utf-8', timeout: 5000 }
    ).trim();

    const allProcs = [];
    for (const line of psOutput.split('\n').slice(1)) {
      const m = line.match(/^\s*(\d+)\s+(\d+)\s+([\d.]+)\s+([\d.]+)\s+(.+)$/);
      if (!m) continue;
      const [, pid, ppid, cpu, mem, cmd] = m;
      allProcs.push({ pid: +pid, ppid: +ppid, cpu: +cpu, mem: +mem, command: cmd.trim() });
    }

    // Step 2: Filter to only node processes (binary must be node, not just matching the word)
    const nodeProcs = allProcs.filter(p => {
      const cmd = p.command;
      // Must run a node binary
      if (!cmd.match(/(?:^|\/)node\s|(?:^|\/)node$|\/tsx\s|\/ts-node\s/)) return false;
      // Exclude our own processes
      if (p.pid === process.pid) return false;
      if (cmd.includes('ray_seeul') || cmd.includes('ray-seeul')) return false;
      if (cmd.includes('/disclaimer ')) return false;
      return true;
    });

    // Step 3: Build parent-child relationships & exclude our server tree
    const myPids = new Set();
    // Find our parent watcher
    try {
      const ppid = execSync(`ps -o ppid= -p ${process.pid}`, { encoding: 'utf-8', timeout: 1000 }).trim();
      myPids.add(+ppid);
      const gppid = execSync(`ps -o ppid= -p ${ppid}`, { encoding: 'utf-8', timeout: 1000 }).trim();
      myPids.add(+gppid);
    } catch { /* skip */ }
    myPids.add(process.pid);
    // Add children of our tree
    let changed = true;
    while (changed) {
      changed = false;
      for (const p of allProcs) {
        if (!myPids.has(p.pid) && myPids.has(p.ppid)) {
          myPids.add(p.pid);
          changed = true;
        }
      }
    }

    const external = nodeProcs.filter(p => !myPids.has(p.pid));

    // Step 4: Group by parent-child
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

    // Step 5: Build global port->PID map with single lsof call (much faster)
    const portByPid = new Map(); // pid -> [{port, pid}]
    try {
      const lsofAll = execSync(
        `lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null`,
        { encoding: 'utf-8', timeout: 5000 }
      ).trim();
      for (const line of lsofAll.split('\n').slice(1)) {
        // Match PID (2nd col) and port from the address:port pattern anywhere in line
        const pidMatch = line.match(/^\S+\s+(\d+)/);
        const portMatch = line.match(/[*:](\d+)\s+\(LISTEN\)/);
        if (!pidMatch || !portMatch) continue;
        const pid = +pidMatch[1];
        const port = +portMatch[1];
        if (!portByPid.has(pid)) portByPid.set(pid, []);
        const existing = portByPid.get(pid);
        if (!existing.some(e => e.port === port)) {
          existing.push({ port, pid });
        }
      }
    } catch { /* skip */ }

    // Step 6: Build result with enriched data
    const results = [];
    for (const proc of parents) {
      const children = childMap.get(proc.pid) || [];
      // Include proc, children, AND parent (ppid) for port scanning
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
        portDetails: [], // {port, pid} - which PID owns which port
        cwd: null,
        projectName: null,
        projectDir: null,
        managed: managedProcesses.has(proc.pid),
        status: 'running'
      };

      // Detect known apps first
      info.projectName = detectKnownApp(proc.command);

      // Collect ports from all related PIDs (self + children + parent)
      const portSet = new Set();
      const portDetails = [];
      for (const pid of allPids) {
        const entries = portByPid.get(pid) || [];
        for (const e of entries) {
          if (!portSet.has(e.port)) {
            portSet.add(e.port);
            portDetails.push({ port: e.port, pid: e.pid });
          }
        }
      }
      info.ports = [...portSet].sort((a, b) => a - b);
      info.portDetails = portDetails.sort((a, b) => a.port - b.port);

      // Get cwd
      if (!info.projectName) {
        try {
          // -a flag forces AND between -p and -d on macOS
          const out = execSync(
            `lsof -a -d cwd -p ${proc.pid} 2>/dev/null | tail -1`,
            { encoding: 'utf-8', timeout: 3000 }
          ).trim();
          if (out) {
            const dm = out.match(/DIR\s+\S+\s+\S+\s+\S+\s+(.+)$/);
            if (dm && dm[1].trim() !== '/') info.cwd = dm[1].trim();
          }
        } catch { /* skip */ }

        // Extract project dir from command or cwd
        const dir = info.cwd || extractProjectDir(proc.command);
        if (dir && dir !== '/') {
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

      if (!info.projectName) {
        info.projectName = extractNameFromCommand(proc.command);
      }

      // Skip if resolved to our own project
      if (info.projectDir?.includes('ray_seeul') || info.projectDir?.includes('ray-seeul')) continue;

      results.push(info);
    }

    // Add managed processes that weren't caught by ps scan
    // (shell: true creates intermediate PIDs that get filtered by myPids)
    const resultPids = new Set(results.map(r => r.pid));
    for (const [pid, managed] of managedProcesses) {
      if (managed.status === 'stopped') continue;
      if (resultPids.has(pid)) continue;

      // Find the actual child node process
      const childPorts = [];
      for (const [p, entries] of portByPid) {
        // Check if this port's PID is a descendant of our managed PID
        const isDescendant = allProcs.some(proc => proc.pid === p && isChildOf(allProcs, p, pid));
        if (isDescendant || p === pid) {
          for (const e of entries) childPorts.push(e);
        }
      }

      const info = {
        pid,
        childPids: [],
        cpu: 0,
        mem: 0,
        command: managed.command,
        ports: [...new Set(childPorts.map(p => p.port))].sort((a, b) => a - b),
        portDetails: childPorts,
        cwd: managed.dir,
        projectName: basename(managed.dir),
        projectDir: managed.dir,
        managed: true,
        status: managed.status || 'running'
      };

      // Try to get name from package.json
      const pkgPath = findPackageJson(managed.dir);
      if (pkgPath) {
        try {
          const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
          info.projectName = pkg.name || info.projectName;
        } catch { /* skip */ }
      }

      if (!info.projectDir?.includes('ray_seeul')) {
        results.push(info);
      }
    }

    return results;
  } catch (e) {
    console.error('Process scan error:', e.message);
    return [];
  }
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

function detectKnownApp(command) {
  if (command.includes('.lmstudio') || command.includes('LM Studio')) return 'LM Studio';
  if (command.includes('Claude.app')) return 'Claude Desktop';
  if (command.includes('Cursor.app') || command.includes('cursor')) return 'Cursor';
  if (command.includes('Visual Studio Code') || command.includes('code-server')) return 'VS Code';
  const appMatch = command.match(/\/([^/]+)\.app\//);
  if (appMatch && !['Helpers', 'Contents'].includes(appMatch[1])) return appMatch[1];
  return null;
}

function extractProjectDir(command) {
  // Find /path/to/project/node_modules/... pattern
  const nmIdx = command.indexOf('/node_modules/');
  if (nmIdx > 0) {
    const before = command.substring(0, nmIdx);
    const pathStart = before.search(/\/(?:Users|home|opt|var|tmp|srv|app)/);
    if (pathStart >= 0) return command.substring(pathStart, nmIdx);
  }
  // Find explicit file path after node command
  const fileMatch = command.match(/\bnode\s+(?:--\S+\s+)*(\/.+?\.[jt]sx?)\b/);
  if (fileMatch) return join(fileMatch[1], '..');
  return null;
}

function extractNameFromCommand(command) {
  const parts = command.split(/\s+/);
  const ni = parts.findIndex(p => p.endsWith('/node') || p === 'node');
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

export function scanKnownProjects() {
  const projects = [];
  const home = homedir();
  const dirs = ['projects', 'dev', 'workspace', 'code', 'repos', 'Desktop', 'Documents'];
  const { customScanDirs } = loadSaved();

  const allDirs = [
    ...dirs.map(d => join(home, d)),
    ...(customScanDirs || [])
  ];
  const seen = new Set();

  for (const dir of allDirs) {
    if (!existsSync(dir)) continue;
    try {
      const entries = execSync(
        `find "${dir}" -maxdepth 3 -name "package.json" -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null`,
        { encoding: 'utf-8', timeout: 10000 }
      ).trim();
      if (!entries) continue;
      for (const pkgPath of entries.split('\n')) {
        if (!pkgPath) continue;
        const projectDir = join(pkgPath, '..');
        if (seen.has(projectDir)) continue;
        seen.add(projectDir);
        try {
          const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
          projects.push({
            name: pkg.name || basename(projectDir),
            dir: projectDir,
            scripts: pkg.scripts ? Object.keys(pkg.scripts) : [],
            hasStartScript: !!(pkg.scripts?.start || pkg.scripts?.dev),
            description: pkg.description || null
          });
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }
  return projects;
}

export function startProcess({ dir, command, port, env = {} }) {
  const processEnv = { ...process.env, ...env, PATH: `/opt/homebrew/bin:${process.env.PATH}` };
  if (port) processEnv.PORT = String(port);

  const child = spawn(command, {
    cwd: dir, env: processEnv, shell: true, detached: false,
    stdio: ['ignore', 'pipe', 'pipe']
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

export function stopProcess(pid) {
  const n = parseInt(pid);
  const managed = managedProcesses.get(n);
  if (managed?.child) {
    try {
      managed.child.kill('SIGTERM');
      setTimeout(() => { try { managed.child.kill('SIGKILL'); } catch {} }, 3000);
      managed.status = 'stopping';
      return { success: true, message: `Process ${n} stopping` };
    } catch (e) { return { success: false, message: e.message }; }
  }
  try {
    process.kill(n, 'SIGTERM');
    return { success: true, message: `Signal sent to ${n}` };
  } catch (e) { return { success: false, message: e.message }; }
}

export function getProcessLogs(pid) {
  return managedProcesses.get(parseInt(pid))?.logs || [];
}

export function getManagedProcesses() {
  return managedProcesses;
}

// Stop the process listening on a specific port
export function stopPortProcess(port) {
  try {
    const out = execSync(
      `lsof -a -iTCP:${port} -sTCP:LISTEN -P -n -t 2>/dev/null`,
      { encoding: 'utf-8', timeout: 3000 }
    ).trim();
    if (!out) return { success: false, message: `No process on port ${port}` };
    const pids = out.split('\n').map(p => +p.trim()).filter(Boolean);
    for (const pid of pids) {
      try { process.kill(pid, 'SIGTERM'); } catch { /* skip */ }
    }
    return { success: true, message: `Stopped ${pids.length} process(es) on port ${port}`, pids };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

// Find a free TCP port
export function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = createNetServer();
    srv.listen(0, () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}
