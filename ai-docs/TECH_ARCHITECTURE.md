# Technical Architecture Documentation

## System Overview

### Frontend-Backend Communication
```javascript
// Tauri command pattern
await invoke('read_markdown_file', { filePath: path });
await invoke('parse_markdown', { content: raw });
await invoke('watch_file', { filePath: path });
```

### Core Dependencies
- **pulldown-cmark**: Markdown parsing (Rust)
- **syntect**: Syntax highlighting (Rust) 
- **tauri-plugin-fs-watch**: File watching (Rust)
- **Web APIs**: KaTeX, search, print (Frontend)

## Performance Architecture

### Performance Targets (from PRD)
- Cold start: <500ms
- File open: <100ms (files <1MB)
- Memory usage: <50MB per document
- File support: Up to 10MB markdown files
- Bundle size: Windows <25MB, macOS <20MB, Linux <30MB

### Performance Implementation Strategy
```rust
// Streaming parser for large files
fn parse_large_markdown(content: &str) -> impl Iterator<Item = Event> {
    Parser::new_ext(content, Options::all())
        .into_offset_iter()
        .take(CHUNK_SIZE)
}
```

### Memory Management
- Use streaming parsers for files >1MB
- Implement virtual scrolling for large documents
- Clear unused file watchers when switching files

## File Handling Architecture

### File Operations Flow
1. **File Open**: User double-clicks .md file
2. **Association**: OS opens app with file path argument
3. **Parse**: Rust backend reads and parses file
4. **Render**: Frontend receives HTML and displays
5. **Watch**: Start file watcher for auto-reload

### File Watching Implementation
```rust
use tauri_plugin_fs_watch::Watcher;

#[tauri::command]
async fn watch_file(path: String, window: Window) -> Result<(), String> {
    let watcher = Watcher::new(path, move |event| {
        window.emit("file-changed", &event).unwrap();
    })?;
    Ok(())
}
```

## UI/UX Guidelines

### Layout Structure
```
┌─────────────────────────────────────┐
│ [Menu Bar] [Zoom] [Find] [Settings] │
├─────────┬───────────────────────────┤  
│   TOC   │                           │
│ Sidebar │     Markdown Content      │
│         │                           │
└─────────┴───────────────────────────┘
```

### Styling Approach
- Base: GitHub-style CSS
- Responsive design for different window sizes
- CSS custom properties for theming
- Print-friendly styles for PDF export

## Error Handling Patterns

### File Errors
```rust
#[derive(thiserror::Error, Debug)]
pub enum MarkdownError {
    #[error("File not found: {0}")]
    FileNotFound(String),
    #[error("File too large: {size}MB (max: 10MB)")]
    FileTooLarge { size: f64 },
    #[error("Parse error: {0}")]
    ParseError(String),
}
```

### Frontend Error Display
```javascript
// Show user-friendly error messages
function handleError(error) {
    if (error.includes("FileNotFound")) {
        showMessage("File not found. Please check if the file exists.");
    }
    // ... other error types
}
```

## Testing Strategy

### Unit Tests
- Rust: Test markdown parsing edge cases
- Frontend: Test UI component behavior
- Integration: Test Tauri command responses

### Performance Tests
```rust
#[cfg(test)]
mod performance_tests {
    #[test] 
    fn test_cold_start_time() {
        let start = Instant::now();
        let app = create_app();
        assert!(start.elapsed() < Duration::from_millis(500));
    }
}
```

### Cross-Platform Tests
- File association on Windows/macOS/Linux
- Build size verification
- Performance benchmarks per platform

## Build Configuration

### Development
```bash
npm run tauri dev
# Auto-reload enabled, debug symbols included
```

### Production
```bash
npm run tauri build --release
# Optimized, minified, code signing applied
```

### Bundle Optimization
- Strip debug symbols: `strip-symbols = true`
- Optimize dependencies: `lto = true`
- Minimize frontend assets: webpack optimization

## Deployment Pipeline

### Code Signing
- Windows: Authenticode certificate
- macOS: Developer ID certificate  
- Automated via GitHub Actions

### Distribution
1. GitHub Releases (primary)
2. Package managers (Homebrew, Winget)
3. Optional: App stores for discovery