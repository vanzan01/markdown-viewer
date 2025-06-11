# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Architecture

This is a Tauri application for viewing markdown files, built with:
- **Frontend**: Vanilla HTML/CSS/JavaScript (in `/src/`)
- **Backend**: Rust using Tauri framework (in `/src-tauri/`)
- **Build target**: Cross-platform desktop application

The frontend (`/src/`) serves as the webview content that gets bundled into the Tauri app. The Rust backend (`/src-tauri/`) handles native system interactions and exposes commands to the frontend via Tauri's IPC system.

## Development Commands

### WSL + Windows Rust Environment

This project uses Windows-installed Rust from WSL. Use PowerShell commands to access the Windows Rust toolchain:

```bash
# Run in development mode (WSL environment)
powershell.exe -Command '$env:PATH += ";C:\Users\nicki\scoop\apps\rustup\current\.cargo\bin"; cd "H:\Active\Markdown-Viewer\project\markdown-viewer"; npm run tauri dev'

# Build for production (WSL environment)
powershell.exe -Command '$env:PATH += ";C:\Users\nicki\scoop\apps\rustup\current\.cargo\bin"; cd "H:\Active\Markdown-Viewer\project\markdown-viewer"; npm run tauri build'

# Check Rust code from WSL
powershell.exe -Command '$env:PATH += ";C:\Users\nicki\scoop\apps\rustup\current\.cargo\bin"; cd "H:\Active\Markdown-Viewer\project\markdown-viewer\src-tauri"; cargo check'
```

**If you encounter Rust/Cargo issues in WSL**, refer to `ai-docs/TROUBLESHOOTING.md` for detailed setup and troubleshooting steps.

### Building and Running
```bash
# Run in development mode (auto-reloads on changes)
npm run tauri dev

# Build for production
npm run tauri build

# Build frontend only (static files)
# No specific command - files in /src/ are served directly
```

### Rust Backend Development
```bash
# From src-tauri directory
cd src-tauri

# Check Rust code
cargo check

# Run Rust tests
cargo test

# Build Rust backend only
cargo build
```

## Key Configuration

- `src-tauri/tauri.conf.json`: Main Tauri configuration
  - Frontend dist points to `../src` (vanilla files)
  - App window size: 800x600
  - CSP disabled for development
- `src-tauri/Cargo.toml`: Rust dependencies and build config
  - Library name: `markdown_viewer_lib` (Windows compatibility)
  - Includes `tauri-plugin-opener` for file operations

## Architecture Notes

- Frontend-backend communication uses Tauri's `invoke()` system
- Rust commands are defined with `#[tauri::command]` macro
- Main entry point: `src-tauri/src/main.rs` calls `lib.rs::run()`
- Frontend access Tauri APIs via `window.__TAURI__` global object