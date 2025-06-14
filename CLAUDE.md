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

## Task Management

**Task Master is the single source of truth for all project tasks and planning.**

### Task Master MCP Commands

```bash
# Get all tasks
mcp__task-master__get_tasks --projectRoot /mnt/h/Active/Markdown-Viewer/project/markdown-viewer

# Get next task to work on
mcp__task-master__next_task --projectRoot /mnt/h/Active/Markdown-Viewer/project/markdown-viewer

# Get specific task details
mcp__task-master__get_task --id 1 --projectRoot /mnt/h/Active/Markdown-Viewer/project/markdown-viewer

# Set task status (pending, in-progress, done, deferred, cancelled)
mcp__task-master__set_task_status --id 1 --status in-progress --projectRoot /mnt/h/Active/Markdown-Viewer/project/markdown-viewer

# Add new task
mcp__task-master__add_task --prompt "Description of new task" --projectRoot /mnt/h/Active/Markdown-Viewer/project/markdown-viewer

# Update existing task
mcp__task-master__update_task --id 1 --prompt "Updated information" --projectRoot /mnt/h/Active/Markdown-Viewer/project/markdown-viewer

# Expand task into subtasks
mcp__task-master__expand_task --id 1 --projectRoot /mnt/h/Active/Markdown-Viewer/project/markdown-viewer

# Add subtask to existing task
mcp__task-master__add_subtask --id 1 --title "Subtask title" --description "Description" --projectRoot /mnt/h/Active/Markdown-Viewer/project/markdown-viewer
```

### Task Master Usage Guidelines

1. **Always start sessions by checking next task**: Use `next_task` to see what should be worked on
2. **Update task status immediately**: Mark tasks as `in-progress` when starting, `done` when complete
3. **Reference task IDs in commits**: Include task ID in commit messages for traceability
4. **Break down complex tasks**: Use `expand_task` for tasks that need more granular planning
5. **Keep tasks updated**: Use `update_task` to reflect progress, blockers, or scope changes

### Current Project Status

The project follows a structured development approach with tasks covering:
- Core markdown rendering functionality
- File handling and associations
- UI/UX improvements
- Performance optimization
- Build and distribution
- Testing and compliance

All tasks are tracked in Task Master with dependencies, priorities, and detailed acceptance criteria.

## Architecture Notes

- Frontend-backend communication uses Tauri's `invoke()` system
- Rust commands are defined with `#[tauri::command]` macro
- Main entry point: `src-tauri/src/main.rs` calls `lib.rs::run()`
- Frontend access Tauri APIs via `window.__TAURI__` global object