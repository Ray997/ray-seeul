const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const pm = require('./processManager');

function createAppServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  app.use(cors());
  app.use(express.json());

  // Serve static renderer files
  app.use(express.static(path.join(__dirname, 'renderer')));

  // REST API
  app.get('/api/processes', (req, res) => {
    try { res.json({ processes: pm.getRunningNodeProcesses() }); }
    catch (e) { res.status(500).json({ error: e.message, stack: e.stack }); }
  });


  app.get('/api/projects', (req, res) => {
    try { res.json({ projects: pm.scanKnownProjects() }); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/processes/start', (req, res) => {
    const { dir, command, port, env } = req.body;
    if (!dir || !command) return res.status(400).json({ error: 'dir and command required' });
    try { res.json(pm.startProcess({ dir, command, port, env })); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/processes/:pid/stop', (req, res) => {
    try { res.json(pm.stopProcess(req.params.pid)); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/processes/:pid/logs', (req, res) => {
    try { res.json({ logs: pm.getProcessLogs(req.params.pid) }); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Saved projects
  app.get('/api/saved', (req, res) => {
    try { res.json({ saved: pm.getSavedWithStatus() }); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/saved', (req, res) => {
    const { name, dir, command, port } = req.body;
    if (!dir || !command) return res.status(400).json({ error: 'dir and command required' });
    try { res.json(pm.saveProject({ name, dir, command, port })); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.delete('/api/saved', (req, res) => {
    const { dir } = req.body;
    if (!dir) return res.status(400).json({ error: 'dir required' });
    try { pm.removeSavedProject(dir); res.json({ success: true }); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/scan-dirs', (req, res) => {
    const { dir } = req.body;
    if (!dir) return res.status(400).json({ error: 'dir required' });
    try { res.json({ customScanDirs: pm.addCustomScanDir(dir) }); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Port operations
  app.post('/api/port/:port/stop', (req, res) => {
    try { res.json(pm.stopPortProcess(+req.params.port)); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/port/free', async (req, res) => {
    try { res.json({ port: await pm.findFreePort() }); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  // SPA fallback
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api/') && !req.path.includes('.')) {
      res.sendFile(path.join(__dirname, 'renderer', 'index.html'));
    } else {
      next();
    }
  });

  // WebSocket
  wss.on('connection', (ws) => {
    let interval;
    const sendUpdate = () => {
      if (ws.readyState !== 1) return;
      try {
        ws.send(JSON.stringify({
          type: 'update',
          processes: pm.getRunningNodeProcesses(),
          saved: pm.getSavedWithStatus()
        }));
      } catch { /* skip */ }
    };

    sendUpdate();
    interval = setInterval(sendUpdate, 3000);

    ws.on('message', (msg) => {
      try {
        const data = JSON.parse(msg);
        if (data.type === 'refresh') sendUpdate();
        if (data.type === 'getLogs') {
          ws.send(JSON.stringify({ type: 'logs', pid: data.pid, data: pm.getProcessLogs(data.pid) }));
        }
        if (data.type === 'subscribeLogs') {
          const li = setInterval(() => {
            if (ws.readyState !== 1) { clearInterval(li); return; }
            ws.send(JSON.stringify({ type: 'logs', pid: data.pid, data: pm.getProcessLogs(data.pid) }));
          }, 1000);
          ws.on('close', () => clearInterval(li));
        }
      } catch { /* skip */ }
    });
    ws.on('close', () => clearInterval(interval));
  });

  return new Promise((resolve) => {
    server.listen(0, () => {
      const port = server.address().port;
      console.log(`Ray Seeul server on http://localhost:${port}`);
      resolve({ server, port });
    });
  });
}

module.exports = { createAppServer };
