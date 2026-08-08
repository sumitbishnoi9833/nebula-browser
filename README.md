# Nebula Browser

A sci-fi themed web browser built with Tauri 2.0, WebView2, and Rust. Features particle backgrounds, AI assistant (Gemini API), command palette, and modern UI.

## Features

- **Sci-fi UI**: Particle background, neon accents, glassmorphism
- **Nebula AI**: Gemini-powered assistant (Ctrl+K)
- **Command Palette**: Ctrl+P for all commands
- **Tabs**: Full tab management with drag, close, reopen
- **Windows Installer**: MSI + NSIS via `tauri build`
- **Lightweight**: ~10MB binary, runs on 4GB RAM

## Requirements

- **Windows 10/11** (WebView2 runtime included)
- **Rust** (stable, via rustup)
- **Node.js 20+** (via nvm/fnm)
- **4GB+ RAM** (8GB recommended for building)

## Quick Start

```bash
# 1. Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"

# 2. Install Node.js (via fnm recommended)
curl -fsSL https://fnm.vercel.app/install | bash
fnm install 20

# 3. Clone & install
cd nebula-browser
npm install

# 4. Generate icons (needs ImageMagick or Inkscape)
bash generate-icons.sh

# 5. Development
npm run dev

# 6. Build installer
npm run build
```

## Build Output

- `src-tauri/target/release/bundle/msi/` - Windows Installer (MSI)
- `src-tauri/target/release/bundle/nsis/` - NSIS Installer
- `src-tauri/target/release/nebula-browser.exe` - Portable exe

## Configuration

Settings stored in `%APPDATA%/nebula-browser/settings.json`:
- `geminiApiKey` - Get from [Google AI Studio](https://aistudio.google.com/apikey)
- `homepage` - Default start page
- `theme` - "nebula" | "matrix" | "void"
- `particleDensity` - 20-100
- `blockTrackers` / `blockAds` - Privacy toggles

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+T | New Tab |
| Ctrl+W | Close Tab |
| Ctrl+Shift+T | Reopen Closed Tab |
| Ctrl+L | Focus Address Bar |
| Ctrl+K | Toggle Nebula AI |
| Ctrl+P | Command Palette |
| Ctrl+, | Settings |
| F11 | Fullscreen |
| F12 | DevTools |
| Alt+←/→ | Back/Forward |
| Ctrl+R | Reload |
| Escape | Close panels |

## Project Structure

```
nebula-browser/
├── src/
│   ├── main.ts                 # Entry point
│   ├── styles/main.css         # Sci-fi theme
│   ├── components/
│   │   ├── TabManager.ts       # Tab system
│   │   ├── ParticleBackground.ts
│   │   ├── AIAssistant.ts      # Gemini integration
│   │   └── CommandPalette.ts
│   └── utils/Settings.ts
├── src-tauri/
│   ├── src/main.rs             # Rust backend
│   ├── Cargo.toml
│   ├── capabilities/default.json
│   └── build.rs
├── index.html
├── newtab.html                 # Custom new tab page
├── tauri.conf.json
├── package.json
└── icons/                      # App icons
```

## Troubleshooting

**WebView2 missing**: Run `winget install Microsoft.EdgeWebView2Runtime`

**Build fails**: Ensure Rust toolchain is stable: `rustup default stable`

**Out of memory**: Add swap file on Windows, or build in CI

**Icons not showing**: Run `bash generate-icons.sh` after installing ImageMagick

## License

MIT
