# Ray Seeul

Node.js Process Manager - Monitor, manage and control all Node.js applications running on your machine.

> **Built with Vibe Coding** - This project was entirely built through conversational AI-assisted development (vibe coding) using [Claude Code](https://claude.ai/claude-code). From architecture decisions to cross-platform process detection, every line was crafted through human-AI collaboration. The project is actively being developed and new features are being added regularly.

## Features

- Auto-detect running Node.js processes
- Port detection with clickable `localhost` links
- CPU / Memory usage monitoring
- Start / stop processes (per-port control)
- Save projects and auto-restart when stopped
- Recognizes known apps (LM Studio, VS Code, Claude, etc.)
- Real-time WebSocket updates
- Dark theme, modern UI
- Cross-platform: macOS, Linux, Windows

## Quick Start

### Electron Desktop App (Recommended)

```bash
git clone https://github.com/Ray997/ray-seeul.git
cd ray-seeul/electron
npm install
npm run build:renderer
npm start
```

### Web Version (Development)

```bash
git clone https://github.com/Ray997/ray-seeul.git
cd ray-seeul
npm run install:all
npm run dev
# Open http://localhost:5173 in your browser
```

## Electron Build

Build for your current platform:

```bash
cd electron
npm install
npm run build:renderer   # Build React frontend
npm run pack             # Test build (unpackaged)
npm run dist             # Production build (DMG/EXE/AppImage)
```

### Platform-Specific Build

```bash
# macOS only
npx electron-builder --mac

# Windows only
npx electron-builder --win

# Linux only
npx electron-builder --linux

# All platforms (cross-compile)
npm run dist:all
```

## Project Structure

```
ray_seeul/
├── server/              # Backend (Node.js + Express + WebSocket)
│   ├── index.js         # API server
│   └── processManager.js
├── client/              # Frontend (React + Vite + Tailwind)
│   └── src/
│       ├── App.jsx
│       └── components/
├── electron/            # Desktop app (Electron)
│   ├── main.js          # Electron main process
│   ├── server.js        # Embedded Express server
│   └── processManager.js # Cross-platform process manager
└── package.json
```

## Cross-Platform Support

| Feature | macOS | Linux | Windows |
|---------|-------|-------|---------|
| Process detection | `ps` | `ps` | `wmic` |
| Port detection | `lsof` | `ss` / `lsof` | `netstat` |
| CWD detection | `lsof -d cwd` | `/proc/PID/cwd` | `wmic` |
| Stop process | `SIGTERM` | `SIGTERM` | `taskkill` |

## Roadmap

This project is under active development. Planned features:

- [ ] Docker container monitoring
- [ ] Process grouping and tagging
- [ ] Resource usage graphs (history)
- [ ] Notifications (high CPU/memory alerts)
- [ ] Multi-machine support (SSH)
- [ ] Plugin system

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

## License

MIT
