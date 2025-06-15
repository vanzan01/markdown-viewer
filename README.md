# 🎉 Markdown Viewer

A professional markdown file viewer for Windows and macOS. Perfect for reading AI outputs, sharing documentation with non-technical staff, and consuming markdown content without friction.

**[📥 Download v1.1.0](https://github.com/vanzan01/markdown-viewer/releases/tag/v1.1.0)** • **[💖 Support This Project](https://github.com/sponsors/vanzan01)**

## ✨ Key Features

### 📄 Reading & Viewing
- **CommonMark Support** - Full markdown spec with GitHub-style rendering
- **Syntax Highlighting** - 20+ programming languages with light/dark themes
- **Mermaid Diagrams** - Flowcharts, sequence diagrams, gantt charts
- **Smart Images** - Local and remote images with seamless loading
- **Find in Page** - Search with highlighting and navigation (Ctrl+F)

### 📤 Export & Share
- **HTML Export** - Standalone files with embedded styles
- **DOCX Export** - Microsoft Word compatible documents  
- **Print to PDF** - Professional formatting for printing

### 🚀 User Experience
- **File Associations** - Double-click .md files to open instantly
- **Drag & Drop** - Drop files into the window
- **Recent Files** - Quick access to previously opened documents
- **Zoom Controls** - 50%-200% scaling with keyboard shortcuts
- **Clean Interface** - Distraction-free reading experience

## 🏆 Perfect For

- **📖 Reading AI Outputs** - View ChatGPT, Claude, and other AI-generated content
- **👔 Non-Technical Staff** - Share documentation without requiring IDEs
- **📋 Stakeholder Reviews** - Present technical docs to managers and clients
- **🤝 Cross-Team Collaboration** - Bridge technical and business teams
- **📄 Documentation Consumption** - Read README files and specs easily
- **💼 Professional Presentations** - Clean, polished markdown viewing

## 📦 Installation

### 🪟 Windows

**🏢 MSI Installer (Recommended)**
- System-wide installation with file associations
- Start menu integration

**🎒 NSIS Setup**
- User-level installation
- No admin rights required

**📱 Standalone Executable**
- Single file, no installation needed

### 🍎 macOS

**📦 DMG Installer**
- Drag & drop installation to Applications
- File associations for .md files

**⚠️ First Launch:** Right-click the app and select "Open" to bypass security warning (unsigned app)

### 🛠️ Build from Source
For developers and security-conscious users
```bash
git clone https://github.com/vanzan01/markdown-viewer.git
cd markdown-viewer
npm install
npm run tauri build
```

## 🎯 Quick Start

1. **📂 Open Files** - Click "Open File", drag & drop, or double-click .md files
2. **📤 Export** - Use Export menu for HTML, DOCX, or PDF output  
3. **🔍 Search** - Press Ctrl+F to find content with highlighting
4. **🔍 Zoom** - Use Ctrl +/- or zoom controls for comfortable reading

## 🌟 Why I Built This

In a world transitioning into AI, there are AI natives and those just starting their journey. AI speaks markdown (MD), but I found it surprisingly difficult for non-AI, non-IDE, non-native users to read and consume this content easily.

I struggled to find decent markdown readers that weren't shareware or freemium for basic features. We should have the fundamental ability to consume information without barriers, and it shouldn't be hard.

We want to share our creations and ideas and be able to do that easily without any friction. So I built this.

**Share. Use. Consume. All for free.**

Whether you want to introduce the world to AI, or let AI introduce you to new possibilities - you decide.

---

*This tool bridges the gap between AI-generated content and human consumption. No paywalls, no feature limitations, no friction. Just pure, accessible markdown reading for everyone.*

## 💖 Support This Project

If you find this tool useful and want to support my work, I would be eternally grateful! 

**[🎁 Become a GitHub Sponsor](https://github.com/sponsors/vanzan01)**

Your support helps me continue building free, accessible tools for everyone.

## 🔧 Built With

- **Tauri + Rust** - Fast, secure desktop application framework
- **Vanilla JavaScript** - Lightweight, efficient frontend  
- **pulldown-cmark** - CommonMark specification compliance
- **syntect** - Professional syntax highlighting

## 📄 License

MIT License - Free for personal and commercial use.

## 🐛 Issues & Support

Found a bug or have a feature request? [Open an issue](https://github.com/vanzan01/markdown-viewer/issues) on GitHub.