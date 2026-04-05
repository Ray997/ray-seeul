import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import {
  getRunningNodeProcesses,
  scanKnownProjects,
  startProcess,
  stopProcess,
  getProcessLogs,
  getSavedProjects,
  saveProject,
  removeSavedProject,
  getSavedWithStatus,
  addCustomScanDir,
  stopPortProcess,
  findFreePort
} from './processManager.js';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

// REST API
app.get('/api/processes', (req, res) => {
  try {
    const processes = getRunningNodeProcesses();
    res.json({ processes });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/projects', (req, res) => {
  try {
    const projects = scanKnownProjects();
    res.json({ projects });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/processes/start', (req, res) => {
  const { dir, command, port, env } = req.body;
  if (!dir || !command) {
    return res.status(400).json({ error: 'dir and command are required' });
  }
  try {
    const result = startProcess({ dir, command, port, env });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/processes/:pid/stop', (req, res) => {
  try {
    const result = stopProcess(req.params.pid);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/processes/:pid/logs', (req, res) => {
  try {
    const logs = getProcessLogs(req.params.pid);
    res.json({ logs });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Saved Projects
app.get('/api/saved', (req, res) => {
  try {
    const saved = getSavedWithStatus();
    res.json({ saved });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/saved', (req, res) => {
  const { name, dir, command, port } = req.body;
  if (!dir || !command) return res.status(400).json({ error: 'dir and command required' });
  try {
    const entry = saveProject({ name, dir, command, port });
    res.json(entry);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/saved', (req, res) => {
  const { dir } = req.body;
  if (!dir) return res.status(400).json({ error: 'dir required' });
  try {
    removeSavedProject(dir);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/scan-dirs', (req, res) => {
  const { dir } = req.body;
  if (!dir) return res.status(400).json({ error: 'dir required' });
  try {
    const dirs = addCustomScanDir(dir);
    res.json({ customScanDirs: dirs });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Port-based operations
app.post('/api/port/:port/stop', (req, res) => {
  try {
    const result = stopPortProcess(+req.params.port);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/port/free', async (req, res) => {
  try {
    const port = await findFreePort();
    res.json({ port });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// WebSocket - real-time updates
wss.on('connection', (ws) => {
  let interval;

  const sendUpdate = () => {
    if (ws.readyState !== 1) return;
    try {
      const processes = getRunningNodeProcesses();
      const saved = getSavedWithStatus();
      ws.send(JSON.stringify({ type: 'update', processes, saved }));
    } catch { /* skip */ }
  };

  sendUpdate();
  interval = setInterval(sendUpdate, 3000);

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);

      if (data.type === 'refresh') {
        sendUpdate();
      }

      if (data.type === 'getLogs') {
        const logs = getProcessLogs(data.pid);
        ws.send(JSON.stringify({ type: 'logs', pid: data.pid, data: logs }));
      }

      if (data.type === 'subscribeLogs') {
        const logInterval = setInterval(() => {
          if (ws.readyState !== 1) { clearInterval(logInterval); return; }
          const logs = getProcessLogs(data.pid);
          ws.send(JSON.stringify({ type: 'logs', pid: data.pid, data: logs }));
        }, 1000);
        ws.on('close', () => clearInterval(logInterval));
      }
    } catch { /* skip */ }
  });

  ws.on('close', () => clearInterval(interval));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Ray Seeul server running on http://localhost:${PORT}`);
});
