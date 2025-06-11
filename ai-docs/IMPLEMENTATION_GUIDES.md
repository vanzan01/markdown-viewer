# Implementation Guides

## 1. Markdown Rendering Implementation (Task 2)

### Dependencies Setup
```toml
# src-tauri/Cargo.toml
[dependencies]
pulldown-cmark = { version = "0.9", default-features = false, features = ["html"] }
syntect = "5.0"
tauri = { version = "1.0", features = ["api-all"] }
```

### Basic Tauri Commands
```rust
// src-tauri/src/lib.rs
#[tauri::command]
pub async fn read_markdown_file(path: String) -> Result<String, String> {
    tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
pub fn parse_markdown(content: String) -> String {
    use pulldown_cmark::{Parser, Options, html};
    
    let mut options = Options::empty();
    options.insert(Options::ENABLE_TABLES);
    options.insert(Options::ENABLE_FOOTNOTES);
    options.insert(Options::ENABLE_STRIKETHROUGH);
    
    let parser = Parser::new_ext(&content, options);
    let mut html_output = String::new();
    html::push_html(&mut html_output, parser);
    html_output
}
```

### Frontend Integration (Vanilla JS)
```javascript
// src/main.js - Class-based approach for better organization
const { invoke } = window.__TAURI__.core;

class MarkdownViewer {
    constructor() {
        this.contentContainer = document.getElementById('content');
    }
    
    async loadMarkdownFile(filePath) {
        try {
            this.showLoading();
            const content = await invoke('read_markdown_file', { path: filePath });
            const html = await invoke('parse_markdown', { content });
            this.renderContent(html);
        } catch (error) {
            this.showError('Failed to load file: ' + error);
        }
    }
    
    renderContent(html) {
        this.contentContainer.innerHTML = `
            <article class="markdown-content">${html}</article>
        `;
    }
    
    showLoading() {
        this.contentContainer.innerHTML = '<div class="loading">Loading...</div>';
    }
    
    showError(message) {
        this.contentContainer.innerHTML = `<div class="error">${message}</div>`;
    }
}

// Initialize when DOM loads
document.addEventListener('DOMContentLoaded', () => {
    window.markdownViewer = new MarkdownViewer();
});
```

**Reference VANILLA_JS_PATTERNS.md for complete component patterns and module organization.**

## 2. File Association Configuration (Task 8)

### Tauri Configuration
```json
// src-tauri/tauri.conf.json
{
  "tauri": {
    "bundle": {
      "identifier": "com.markdown-viewer.app",
      "icon": ["icons/32x32.png", "icons/128x128.png"],
      "resources": [],
      "externalBin": [],
      "copyright": "",
      "category": "DeveloperTool",
      "shortDescription": "Simple Markdown Viewer",
      "longDescription": "A fast, simple markdown file viewer",
      "fileAssociations": [
        {
          "ext": ["md", "markdown", "mdown", "mkd"],
          "name": "Markdown Document",
          "description": "Markdown Document", 
          "role": "Viewer"
        }
      ]
    }
  }
}
```

### Platform-Specific Notes
- **Windows**: Registry entries created automatically
- **macOS**: Info.plist configured via fileAssociations
- **Linux**: .desktop file generated with MIME types

### Testing File Associations
```bash
# Test file association
echo "# Test" > test.md
# Double-click test.md - should open in app
```

## 3. Performance Optimization (Task 17)

### Benchmarking Setup
```rust
// src-tauri/src/performance.rs
use std::time::Instant;

pub struct PerformanceMetrics {
    pub cold_start_time: Duration,
    pub file_open_time: Duration,
    pub memory_usage: usize,
}

#[tauri::command]
pub fn benchmark_file_open(path: String) -> Result<f64, String> {
    let start = Instant::now();
    let _content = std::fs::read_to_string(path)?;
    Ok(start.elapsed().as_millis() as f64)
}
```

### Memory Optimization
```rust
// Use lazy loading for large files
fn parse_large_file(content: &str) -> impl Iterator<Item = String> {
    content.lines()
        .enumerate()
        .map(|(i, line)| format!("{}: {}", i + 1, line))
        .take(1000) // Limit initial render
}
```

### Frontend Performance
```javascript
// Virtual scrolling for large documents
function setupVirtualScrolling() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                loadMoreContent();
            }
        });
    });
}
```

## 4. File Watching Implementation (Task 16)

### Rust File Watcher
```toml
# Add to Cargo.toml
notify = "6.0"
```

```rust
// src-tauri/src/watcher.rs
use notify::{Watcher, RecursiveMode, Result};
use std::sync::mpsc::channel;
use std::time::Duration;

#[tauri::command]
pub fn start_file_watch(path: String, window: tauri::Window) -> Result<(), String> {
    let (tx, rx) = channel();
    
    let mut watcher = notify::watcher(tx, Duration::from_secs(1))
        .map_err(|e| e.to_string())?;
    
    watcher.watch(&path, RecursiveMode::NonRecursive)
        .map_err(|e| e.to_string())?;
    
    tauri::async_runtime::spawn(async move {
        loop {
            match rx.recv() {
                Ok(event) => {
                    window.emit("file-changed", &event).unwrap();
                }
                Err(e) => break,
            }
        }
    });
    
    Ok(())
}
```

### Frontend Auto-Reload
```javascript
// Listen for file changes
listen('file-changed', (event) => {
    console.log('File changed:', event.payload);
    reloadCurrentFile();
});
```

## 5. Build Optimization (Task 18)

### Cargo.toml Optimizations
```toml
[profile.release]
opt-level = "z"     # Optimize for size
lto = true          # Link time optimization
codegen-units = 1   # Single codegen unit
panic = "abort"     # Smaller binary
strip = true        # Strip symbols
```

### Frontend Bundle Optimization
```javascript
// Minimize CSS and JS
const PRODUCTION_CONFIG = {
    minify: true,
    treeshake: true,
    sourcemap: false
};
```

### Size Monitoring
```bash
# Check build sizes
ls -lh src-tauri/target/release/
# Target: Windows <25MB, macOS <20MB, Linux <30MB
```

## 6. Testing Requirements (Task 20)

### CommonMark Test Suite
```rust
#[cfg(test)]
mod commonmark_tests {
    use super::*;
    
    #[test]
    fn test_commonmark_compliance() {
        let test_cases = include_str!("../../tests/commonmark.json");
        // Run all CommonMark spec tests
    }
}
```

### UI Testing
```javascript
// Frontend tests
describe('Markdown Viewer', () => {
    test('renders markdown correctly', async () => {
        const result = await loadMarkdown('# Test\n\nParagraph');
        expect(result).toContain('<h1>Test</h1>');
    });
});
```

### Performance Tests
```rust
#[test]
fn performance_requirements() {
    assert!(cold_start_time() < Duration::from_millis(500));
    assert!(file_open_time("test.md") < Duration::from_millis(100));
    assert!(memory_usage() < 50 * 1024 * 1024); // 50MB
}
```