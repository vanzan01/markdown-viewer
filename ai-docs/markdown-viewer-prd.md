# Simple Markdown Viewer - Product Requirements Document

## Executive Summary

**Product Vision**: Create a dead-simple markdown viewer that works like a PDF viewer - double-click a .md file and it just opens. No accounts, no cloud, no subscriptions. Just a fast, beautiful viewer distributed as a single executable.

**Problem Statement**: Every markdown solution today is either a text editor with preview, a SaaS platform, or a freemium app trying to upsell features. Nobody has built the equivalent of Adobe Reader for markdown - a dedicated viewer that just works.

**Success Metrics**: 
- 10,000+ downloads in first 6 months
- <5MB Windows executable (excluding runtime)
- <500ms cold start time
- Zero configuration required
- Becomes the default .md file handler for users

## Core Philosophy

**What This Is**
- A viewer, not an editor
- A single executable, not a platform
- A tool, not a service
- Free and open source, not freemium

**What This Isn't**
- Not another markdown editor
- Not a note-taking app
- Not a cloud service
- Not a subscription product

## Target Users

### Primary User
**Anyone Who Receives Markdown Files**
- Doesn't want to install VS Code just to read a README
- Needs to view documentation without editing
- Wants markdown files to "just open" like PDFs
- Values simplicity and speed over features

### Secondary Users
- **Documentation Reviewers**: Read without accidentally editing
- **Non-Technical Users**: View technical docs without complexity
- **System Administrators**: Deploy simple viewer across organizations
- **Students**: Read course materials and notes

## Core Features (Keeping It Simple)

### MVP - Just the Essentials

**Viewing**
- Render CommonMark standard markdown
- Syntax highlighting for code blocks
- Display images (local and remote)
- Render tables cleanly
- Show math equations (KaTeX)
- Display Mermaid diagrams

**Navigation**
- Table of contents sidebar (auto-generated)
- Smooth scrolling
- Zoom in/out (50%-200%)
- Find in page (Ctrl+F)
- Navigate headers with keyboard

**File Handling**
- Double-click any .md file to open
- Drag & drop files onto app
- Recent files list
- Associate with .md extension
- Auto-reload when file changes

**Export**
- Print to PDF with pagination
- Copy selection as formatted text
- Save as HTML (self-contained)

### Phase 2 - Polish

**Better Rendering**
- GitHub Flavored Markdown support
- Footnotes with jump links
- Task lists (display only)
- More diagram types (PlantUML)
- Better image handling (zoom, lightbox)

**Themes**
- GitHub theme (default)
- Dark mode
- High contrast
- Academic (serif fonts)
- Custom CSS support

**Quality of Life**
- Remember window size/position
- Remember zoom level per file
- Quick file switcher (Ctrl+P)
- Markdown file tree viewer
- Full-screen reading mode

### Future Considerations (Maybe Never)
- Multiple tabs
- Search across files
- Export to other formats
- Plugin system
- Cloud sync

## Technical Implementation

### Technology Stack

**Core Framework: Tauri + Rust**
```toml
# Why Tauri?
# - 15-25MB executable (vs 100MB+ for Electron)
# - Truly native performance
# - Uses system webview (no bundled Chrome)
# - Single executable output
```

**Architecture Overview**
```
markdown-viewer/
├── src-tauri/          # Rust backend (minimal)
│   ├── src/
│   │   └── main.rs     # ~50 lines: file I/O + markdown parsing
│   └── Cargo.toml      # Dependencies: tauri, pulldown-cmark
├── src/                # Frontend (where UI lives)
│   ├── index.html      # Simple document viewer layout
│   ├── style.css       # GitHub-inspired markdown styling
│   └── main.js         # Handle file operations, rendering
└── package.json        # Build configuration
```

**Key Dependencies**
- **pulldown-cmark**: Fast, correct markdown parsing
- **syntect**: Syntax highlighting
- **KaTeX**: Math rendering (client-side)
- **Mermaid.js**: Diagram rendering (client-side)

### Build & Distribution

**Single Command Build**
```bash
npm run tauri build

# Outputs:
# Windows: markdown-viewer.exe (15-25MB)
# macOS: markdown-viewer.app (12-20MB)  
# Linux: markdown-viewer (18-30MB)
```

**Distribution Model**
1. **GitHub Releases**: Direct downloads, no installation
2. **Homebrew**: `brew install markdown-viewer` (macOS/Linux)
3. **Winget**: `winget install markdown-viewer` (Windows)
4. **Optional**: Microsoft Store, Mac App Store for discoverability

**Key Point**: No installers needed. Users download one file and run it.

### Performance Requirements

**Hard Requirements**
- Cold start: <500ms
- File open: <100ms for files under 1MB
- Scroll performance: 60fps
- Memory usage: <50MB for single document
- File size support: Up to 10MB markdown files

**Build Size Targets**
- Windows: <25MB executable
- macOS: <20MB app bundle
- Linux: <30MB AppImage

## Development Approach

### Minimum Viable Product (Week 1-2)

**Week 1: Core Viewer**
```rust
// src-tauri/src/main.rs - Entire backend
#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn parse_markdown(content: String) -> String {
    let parser = pulldown_cmark::Parser::new(&content);
    let mut html = String::new();
    pulldown_cmark::html::push_html(&mut html, parser);
    html
}
```

**Week 2: Polish & Package**
- Add syntax highlighting
- Implement TOC generation
- Create file associations
- Build for all platforms

### Phase 2: Enhancement (Week 3-4)
- Add theming support
- Implement find functionality
- Add print/export features
- Create auto-update system

### Phase 3: Distribution (Week 5-6)
- Set up GitHub releases
- Create Homebrew formula
- Submit to package managers
- Write documentation

## Go-to-Market Strategy

### Launch Strategy: "It Just Works"

**Core Message**: "The PDF viewer for markdown files"

**Week 1: Soft Launch**
1. Post on r/markdown, r/programming
2. "Show HN" on Hacker News
3. Share in markdown tool discussions
4. Focus on the single-exe simplicity

**Week 2-4: Developer Outreach**
1. GitHub README badges: "View in Markdown Viewer"
2. Integration with documentation tools
3. Corporate IT department outreach
4. Educational institution contacts

**Success Indicators**
- Organic GitHub stars (target: 1,000 in first month)
- Unsolicited blog posts/tweets
- Feature requests for viewing (not editing)
- Corporate deployment inquiries

### Monetization: None

**Why Free?**
- This is infrastructure, like a PDF viewer
- Monetizing would compromise simplicity
- Open source builds trust and contributions
- Optional donations for hosting/signing certificates

## Risk Mitigation

### Technical Risks
**Risk**: Webview inconsistencies across platforms
**Mitigation**: Extensive testing, graceful fallbacks

**Risk**: Large file performance
**Mitigation**: Virtual scrolling, progressive rendering

### Market Risks
**Risk**: Users expect editing features
**Mitigation**: Clear messaging, suggest editor alternatives

**Risk**: Low adoption due to existing tools
**Mitigation**: Focus on non-technical users, IT departments

## Success Criteria

### User Feedback
- "Finally, a markdown viewer that just works"
- "I set this as my default .md handler"
- "Deployed across our 500-person company"
- "My non-technical manager can now read our docs"

### Metrics That Matter
- Download-to-daily-use ratio >50%
- <1% uninstall rate
- File association retention >80%
- Zero user accounts needed

## Resource Requirements

### Development Team
- 1 Developer (Tauri/Rust experience helpful)
- 1 Designer (part-time for icon/theme)
- Total: ~1.5 people for 6 weeks

### Infrastructure
- GitHub repository (free)
- GitHub Actions for CI/CD (free)
- GitHub Releases for distribution (free)
- Code signing certificates (~$300/year)

### Estimated Costs
- Development: $15,000 (6 weeks)
- Code signing: $300/year
- Domain/website: $100/year
- **Total Year 1**: <$20,000

## Why This Will Succeed

1. **Real Problem**: Everyone has received a .md file and wished it would "just open"
2. **Simple Solution**: One executable, no complexity
3. **Fast Development**: 6 weeks to MVP with Tauri
4. **Low Risk**: Minimal investment, open source
5. **Clear Niche**: The space between text editors and note-taking apps

## Next Steps

1. Create GitHub repository
2. Build MVP in Tauri (1-2 weeks)
3. Test with 10 beta users
4. Polish based on feedback
5. Launch on GitHub/HN
6. Iterate based on user needs (viewing only!)

---

*The goal: Make markdown files as easy to open as PDFs.*

*Document Version: 2.0*  
*Last Updated: June 11, 2025*