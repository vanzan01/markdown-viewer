# Markdown Viewer

A fast, simple markdown file viewer for Windows. Double-click any `.md` file and view it with beautiful GitHub-style rendering.

## ✨ Features

- **📄 CommonMark Support** - Full markdown specification with GitHub styling
- **🎨 Syntax Highlighting** - 20+ programming languages with color coding  
- **📂 File Associations** - Double-click .md files to open instantly
- **🎯 Drag & Drop** - Drop markdown files into the window
- **🔄 Auto-Reload** - Live updates when files change on disk
- **🔍 Find in Page** - Search with Ctrl+F, highlighting and navigation
- **🔍 Zoom Controls** - 50%-200% zoom with keyboard shortcuts (Ctrl +/-)
- **📤 Export Options** - Save as HTML, DOCX, or print to PDF
- **📋 Recent Files** - Quick access to recently opened documents
- **📊 Rich Content** - Tables, images, task lists, footnotes, strikethrough
- **🎯 Mermaid Diagrams** - Flowcharts, sequence diagrams, and gantt charts

## 📦 Download

**[Download Latest Release (v0.1.0)](https://github.com/vanzan01/markdown-viewer/releases/latest)**

### Installation Options:
- **NSIS Installer** (3.1MB) - Recommended for most users
- **MSI Installer** (4.9MB) - For enterprise environments

### System Requirements:
- Windows 10/11 (x64)
- ~15MB disk space

## 🚀 Usage

1. **Install** - Download and run the installer
2. **Open Files** - Double-click any .md file, or drag & drop into the app  
3. **Export** - Use the Export dropdown to save as HTML, DOCX, or PDF
4. **Search** - Press Ctrl+F to find text with highlighting
5. **Zoom** - Use Ctrl +/- to zoom in/out, Ctrl+0 to reset

### Keyboard Shortcuts:
- **Ctrl+F** - Find in page
- **Ctrl++** - Zoom in  
- **Ctrl+-** - Zoom out
- **Ctrl+0** - Reset zoom

## 🎯 Perfect For

- **Developers** - View README files and documentation
- **Writers** - Preview markdown drafts with live reload
- **Students** - Read course materials and notes
- **Teams** - Share formatted documents without complexity

## 🛠️ Build from Source

Prefer to build from source? Here's how:

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or later)
- [Rust](https://rustlang.org/) (latest stable)

### Build Steps
```bash
# 1. Clone the repository
git clone https://github.com/vanzan01/markdown-viewer.git
cd markdown-viewer

# 2. Install JavaScript dependencies
npm install

# 3. Build the application
npm run tauri build
```

Your built executable will be in:
- **Windows**: `src-tauri/target/release/markdown-viewer.exe`
- **Installers**: `src-tauri/target/release/bundle/`

### Development Mode
To run in development mode with hot reload:
```bash
npm run tauri dev
```

## 🔧 Built With

- **Tauri + Rust** - Fast, secure desktop application
- **Vanilla JavaScript** - Lightweight frontend
- **pulldown-cmark** - CommonMark specification compliance
- **syntect** - Professional syntax highlighting

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🐛 Issues & Support

Found a bug or have a feature request? Please [open an issue](https://github.com/vanzan01/markdown-viewer/issues) on GitHub.