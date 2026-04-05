# Ray Seeul

Node.js Process Manager - Makinenizdeki tum Node.js uygulamalarini izleyin, yonetin ve kontrol edin.

## Ozellikler

- Calisan Node.js processlerini otomatik tespit
- Port tespiti ve tiklanabilir `localhost` linkleri
- CPU / Bellek kullanimi izleme
- Process baslatma / durdurma (per-port kontrol)
- Proje kaydetme ve otomatik yeniden baslatma
- LM Studio, VS Code, Claude gibi bilinen uygulamalari tanimlama
- Gercek zamanli WebSocket guncellemeleri
- Koyu tema, modern UI

## Hizli Kurulum

### Electron Desktop App (Tavsiye Edilen)

```bash
git clone https://github.com/Ray997/ray-seeul.git
cd ray-seeul/electron
npm install
npm start
```

### Web Versiyonu (Gelistirme)

```bash
git clone https://github.com/Ray997/ray-seeul.git
cd ray-seeul
npm run install:all
npm run dev
# Tarayicida http://localhost:5173 adresini acin
```

## Electron Build

Kendi platformunuz icin build almak:

```bash
cd electron
npm install
npm run build:renderer   # React frontend build
npm run pack             # Test build (unpackaged)
npm run dist             # Production build (DMG/EXE/AppImage)
```

### Platform-Spesifik Build

```bash
# Sadece macOS
npx electron-builder --mac

# Sadece Windows
npx electron-builder --win

# Sadece Linux
npx electron-builder --linux

# Hepsi birden (cross-compile)
npm run dist:all
```

## Proje Yapisi

```
ray_seeul/
├── server/              # Backend (Node.js + Express + WebSocket)
│   ├── index.js         # API server
│   └── processManager.js # Process discovery & management
├── client/              # Frontend (React + Vite + Tailwind)
│   └── src/
│       ├── App.jsx
│       └── components/  # Dashboard, ProcessCard, Terminal, vb.
├── electron/            # Desktop app (Electron)
│   ├── main.js          # Electron main process
│   ├── server.js        # Embedded Express server
│   └── processManager.js # Cross-platform (macOS/Linux/Windows)
└── package.json
```

## Cross-Platform Destek

| Ozellik | macOS | Linux | Windows |
|---------|-------|-------|---------|
| Process tespiti | `ps` | `ps` | `wmic` |
| Port tespiti | `lsof` | `ss` / `lsof` | `netstat` |
| CWD tespiti | `lsof -d cwd` | `/proc/PID/cwd` | `wmic` |
| Process durdurma | `SIGTERM` | `SIGTERM` | `taskkill` |

## Lisans

MIT
