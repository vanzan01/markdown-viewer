# Simple Markdown Viewer

A fast, simple markdown file viewer that works like a PDF viewer - double-click a `.md` file and it just opens. No accounts, no cloud, no subscriptions. Just a beautiful viewer distributed as a single executable.

## Features

- **Dead Simple**: Double-click any `.md` file to open
- **Fast**: <500ms cold start, optimized for large files
- **Beautiful**: GitHub-style markdown rendering
- **Auto-reload**: Watches file changes automatically
- **Cross-platform**: Windows, macOS, and Linux

## Development

This project is built with Tauri + Vanilla JavaScript for maximum performance and minimal bundle size.

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- [Rust](https://rustlang.org/) (latest stable)

### Development Setup

```bash
# Install dependencies
npm install

# Start development server
npm run tauri dev

# Build for production
npm run tauri build
```

### Performance Targets

- Cold start: <500ms
- File open: <100ms (files <1MB)
- Memory usage: <50MB per document
- Bundle size: Windows <25MB, macOS <20MB, Linux <30MB

## Architecture

- **Frontend**: Vanilla HTML/CSS/JavaScript (in `/src/`)
- **Backend**: Rust using Tauri framework (in `/src-tauri/`)
- **Markdown**: `pulldown-cmark` for CommonMark compliance
- **Syntax Highlighting**: `syntect` for code blocks

## Documentation

- [Product Requirements](ai-docs/markdown-viewer-prd.md)
- [Technical Architecture](ai-docs/TECH_ARCHITECTURE.md)
- [Implementation Guide](ai-docs/IMPLEMENTATION_GUIDES.md)
- [UI/UX Guide](ai-docs/UI_UX_GUIDE.md)
- [Vanilla JS Patterns](ai-docs/VANILLA_JS_PATTERNS.md)

## License

MIT License - see [LICENSE](LICENSE) file for details.
