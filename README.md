# Ray Seeul

Node.js Process Manager - Monitor, manage and control all Node.js applications running on your machine.

> **Built with Vibe Coding** - This project was entirely built through conversational AI-assisted development (vibe coding) using [Claude Code](https://claude.ai/claude-code). The project is actively being developed and new features are being added regularly.

## Download

### macOS (Apple Silicon)

1. Download the latest `.zip` from [Releases](https://github.com/Ray997/ray-seeul/releases)
2. Extract and move `Ray Seeul.app` to your Applications folder
3. Open the app - it's signed and notarized, no security warnings

### Build from Source (All Platforms)

```bash
git clone https://github.com/Ray997/ray-seeul.git
cd ray-seeul/electron
npm install
npm run build:renderer
npm start
```

## Features

- Auto-detect running Node.js processes
- Port detection with clickable `localhost` links
- Per-port stop/restart controls
- CPU / Memory usage monitoring
- Save projects and auto-restart when stopped
- Recognizes known apps (LM Studio, VS Code, Claude, etc.)
- Real-time WebSocket updates (3s polling)
- Start new processes with custom port or auto-assign free port
- Dark theme, modern UI

## Screenshots

*Coming soon*

## Web Version (Development)

You can also run Ray Seeul as a web app without Electron:

```bash
git clone https://github.com/Ray997/ray-seeul.git
cd ray-seeul
npm run install:all
npm run dev
# Open http://localhost:5173
```

## Build Electron App

```bash
cd electron
npm install
npm run build:renderer

# Current platform
npm run dist

# Platform-specific
npx electron-builder --mac
npx electron-builder --win
npx electron-builder --linux
```

## Project Structure

```
ray_seeul/
├── server/              # Backend (Node.js + Express + WebSocket)
├── client/              # Frontend (React + Vite + Tailwind)
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
