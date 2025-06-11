# Markdown Viewer

A fast, cross-platform markdown file viewer built with Tauri. Double-click any `.md` file and it opens instantly with beautiful GitHub-style rendering. No accounts, no cloud, no subscriptions - just a powerful local viewer.

## ✨ Features

### 📄 **Core Markdown Support**
- **CommonMark Compliant**: Full CommonMark specification support
- **GitHub-Style Rendering**: Beautiful, familiar markdown styling
- **Strikethrough**: ~~Cross out~~ text support
- **Footnotes**: Reference-style footnotes with auto-linking
- **Task Lists**: Interactive checkboxes for todo items

### 💻 **Code & Syntax**
- **Syntax Highlighting**: 20+ programming languages with color coding
- **Code Blocks**: Fenced code blocks with language detection
- **Inline Code**: Styled `inline code` snippets

### 📊 **Rich Content**
- **Tables**: Full table rendering with GitHub styling and alignment
- **Images**: Local and remote images with enhanced styling and error handling
- **Mermaid Diagrams**: Interactive flowcharts, sequence diagrams, gantt charts, class diagrams, and pie charts

### 🚀 **User Experience**
- **File Associations**: Double-click `.md` files to open
- **Drag & Drop**: Drop markdown files into the window
- **Auto-Reload**: Live updates when files change on disk
- **HTML Export**: Export documents as standalone HTML files

### ⚡ **Performance**
- **Fast Startup**: <500ms cold start time
- **Responsive**: Optimized for large files up to 10MB
- **Low Memory**: <50MB memory usage per document
- **Cross-Platform**: Windows, macOS, and Linux support

## 🖼️ Screenshots

The app features a clean, GitHub-style interface with comprehensive markdown support:

- **Sample Content**: Click "Try Sample" to see all features in action
- **Mermaid Diagrams**: Interactive flowcharts, sequence diagrams, and gantt charts
- **Syntax Highlighting**: 20+ programming languages with proper theming
- **Tables & Images**: Full support with responsive design
- **Export**: Generate standalone HTML files with embedded styling

## 🎯 Roadmap

### ✅ **Completed Features**
- Core markdown rendering with CommonMark compliance
- Syntax highlighting for 20+ languages
- File associations and drag & drop support
- Auto-reload file watching
- Table and image rendering with GitHub styling
- Mermaid diagram support (flowcharts, sequence, gantt, class, pie)
- HTML export functionality
- Cross-platform Tauri application

### 🔄 **Coming Soon**
- Find in page (Ctrl+F) with highlighting
- Table of contents sidebar
- Print to PDF support
- Dark mode and additional themes
- Recent files list
- Zoom in/out functionality

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

#### WSL Development

If developing in WSL with Windows-installed Rust, use these commands instead:

```bash
# Start development server (WSL + Windows Rust)
powershell.exe -Command '$env:PATH += ";C:\Users\nicki\scoop\apps\rustup\current\.cargo\bin"; cd "H:\Active\Markdown-Viewer\project\markdown-viewer"; npm run tauri dev'

# Build for production (WSL + Windows Rust)
powershell.exe -Command '$env:PATH += ";C:\Users\nicki\scoop\apps\rustup\current\.cargo\bin"; cd "H:\Active\Markdown-Viewer\project\markdown-viewer"; npm run tauri build'
```

For troubleshooting WSL + Rust setup issues, see [ai-docs/TROUBLESHOOTING.md](ai-docs/TROUBLESHOOTING.md).

### Performance Targets

- Cold start: <500ms
- File open: <100ms (files <1MB)
- Memory usage: <50MB per document
- Bundle size: Windows <25MB, macOS <20MB, Linux <30MB

## 🏗️ Architecture

- **Frontend**: Vanilla HTML/CSS/JavaScript (in `/src/`)
  - Pure JavaScript for maximum performance
  - CSS with GitHub-style theming and responsive design
  - Mermaid.js v10.6.1 for interactive diagrams
- **Backend**: Rust using Tauri v2.0 framework (in `/src-tauri/`)
  - `pulldown-cmark` v0.9 for CommonMark specification compliance
  - `syntect` v5.0 for syntax highlighting with 20+ language support
  - `notify` v6.0 for file system watching and auto-reload
  - `tauri-plugin-opener` for file associations and system integration
- **Build**: Cross-platform executable generation with minimal bundle size
- **Security**: Sandboxed execution with controlled file system access

## Documentation

- [Product Requirements](ai-docs/markdown-viewer-prd.md)
- [Technical Architecture](ai-docs/TECH_ARCHITECTURE.md)
- [Implementation Guide](ai-docs/IMPLEMENTATION_GUIDES.md)
- [UI/UX Guide](ai-docs/UI_UX_GUIDE.md)
- [Vanilla JS Patterns](ai-docs/VANILLA_JS_PATTERNS.md)
- [WSL Development Troubleshooting](ai-docs/TROUBLESHOOTING.md)

## License

MIT License - see [LICENSE](LICENSE) file for details.
