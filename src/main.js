const { invoke } = window.__TAURI__.core;
const { open, save } = window.__TAURI__.dialog;
const { writeTextFile } = window.__TAURI__.fs;

let currentFilePath = null;
let isInitialized = false;
let currentMarkdownContent = '';
let currentTitle = 'Untitled';
let mermaidInitialized = false;

// Find in page variables
let searchDialog = null;
let searchInput = null;
let searchResults = [];
let currentResultIndex = -1;
let searchTerm = '';
let isSearchDialogVisible = false;

// DOM elements
let openFileBtn;
let fileInput;
let welcomeScreen;
let markdownViewer;
let markdownContent;
let exportHtmlBtn;

function createSearchDialog() {
  if (searchDialog) return;
  
  // Create search dialog container
  searchDialog = document.createElement('div');
  searchDialog.className = 'search-dialog';
  searchDialog.innerHTML = `
    <div class="search-container">
      <input type="text" class="search-input" placeholder="Find in page..." />
      <div class="search-controls">
        <button class="search-btn search-prev" title="Previous (Shift+Enter)">↑</button>
        <button class="search-btn search-next" title="Next (Enter)">↓</button>
        <span class="search-counter">0/0</span>
        <button class="search-btn search-close" title="Close (Escape)">×</button>
      </div>
    </div>
  `;
  
  // Append to body
  document.body.appendChild(searchDialog);
  
  // Get references
  searchInput = searchDialog.querySelector('.search-input');
  const prevBtn = searchDialog.querySelector('.search-prev');
  const nextBtn = searchDialog.querySelector('.search-next');
  const closeBtn = searchDialog.querySelector('.search-close');
  const counter = searchDialog.querySelector('.search-counter');
  
  // Event listeners
  searchInput.addEventListener('input', handleSearchInput);
  searchInput.addEventListener('keydown', handleSearchKeydown);
  prevBtn.addEventListener('click', () => navigateResults(-1));
  nextBtn.addEventListener('click', () => navigateResults(1));
  closeBtn.addEventListener('click', hideSearchDialog);
  
  // Store counter reference for updates
  searchDialog.counter = counter;
}

function showSearchDialog() {
  if (!markdownContent || markdownContent.style.display === 'none') {
    return; // Don't show search if no content is loaded
  }
  
  createSearchDialog();
  isSearchDialogVisible = true;
  searchDialog.style.display = 'block';
  searchInput.focus();
  searchInput.select();
}

function hideSearchDialog() {
  if (!searchDialog) return;
  
  isSearchDialogVisible = false;
  searchDialog.style.display = 'none';
  clearSearchResults();
  searchInput.value = '';
  searchTerm = '';
}

function handleSearchInput(event) {
  const newSearchTerm = event.target.value.trim();
  
  if (newSearchTerm !== searchTerm) {
    searchTerm = newSearchTerm;
    if (searchTerm.length > 0) {
      performSearch(searchTerm);
    } else {
      clearSearchResults();
    }
  }
}

function handleSearchKeydown(event) {
  switch (event.key) {
    case 'Enter':
      event.preventDefault();
      if (event.shiftKey) {
        navigateResults(-1);
      } else {
        navigateResults(1);
      }
      break;
    case 'Escape':
      event.preventDefault();
      hideSearchDialog();
      break;
  }
}

function performSearch(term) {
  if (!term || !markdownContent) {
    clearSearchResults();
    return;
  }
  
  // Clear previous results
  clearSearchResults();
  
  // Get all text nodes in the content
  const walker = document.createTreeWalker(
    markdownContent,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        const parent = node.parentElement;
        
        // Skip script and style elements
        if (parent && (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE')) {
          return NodeFilter.FILTER_REJECT;
        }
        
        // Skip hidden elements
        if (parent && (parent.style.display === 'none' || parent.hidden)) {
          return NodeFilter.FILTER_REJECT;
        }
        
        // Skip elements that are not visible (check computed style safely)
        try {
          if (parent && window.getComputedStyle(parent).display === 'none') {
            return NodeFilter.FILTER_REJECT;
          }
        } catch (e) {
          // Ignore errors from getComputedStyle
        }
        
        // Skip search highlight spans to avoid duplicate results
        if (parent && (parent.classList.contains('search-highlight') || parent.classList.contains('search-highlight-current'))) {
          return NodeFilter.FILTER_REJECT;
        }
        
        // Skip if parent is already a search highlight span
        let currentElement = parent;
        while (currentElement) {
          if (currentElement.classList && (currentElement.classList.contains('search-highlight') || currentElement.classList.contains('search-highlight-current'))) {
            return NodeFilter.FILTER_REJECT;
          }
          currentElement = currentElement.parentElement;
        }
        
        // Only accept text nodes with actual content (not just whitespace)
        if (!node.textContent || node.textContent.trim().length === 0) {
          return NodeFilter.FILTER_REJECT;
        }
        
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );
  
  const textNodes = [];
  let node;
  while (node = walker.nextNode()) {
    textNodes.push(node);
  }
  
  // Search through text nodes
  const regex = new RegExp(escapeRegex(term), 'gi');
  
  textNodes.forEach(textNode => {
    const text = textNode.textContent;
    const matches = [...text.matchAll(regex)];
    
    if (matches.length > 0) {
      // Split the text node and wrap matches
      let lastIndex = 0;
      const parent = textNode.parentNode;
      
      matches.forEach(match => {
        const matchStart = match.index;
        const matchEnd = matchStart + match[0].length;
        
        // Insert text before match
        if (matchStart > lastIndex) {
          const beforeText = text.slice(lastIndex, matchStart);
          parent.insertBefore(document.createTextNode(beforeText), textNode);
        }
        
        // Create highlighted span for match
        const highlightSpan = document.createElement('span');
        highlightSpan.className = 'search-highlight';
        highlightSpan.textContent = match[0];
        highlightSpan.setAttribute('data-search-result', searchResults.length);
        parent.insertBefore(highlightSpan, textNode);
        
        // Add to results array
        searchResults.push(highlightSpan);
        
        lastIndex = matchEnd;
      });
      
      // Insert remaining text after last match
      if (lastIndex < text.length) {
        const afterText = text.slice(lastIndex);
        parent.insertBefore(document.createTextNode(afterText), textNode);
      }
      
      // Remove original text node
      parent.removeChild(textNode);
    }
  });
  
  // Update counter and navigate to first result
  updateSearchCounter();
  if (searchResults.length > 0) {
    currentResultIndex = 0;
    highlightCurrentResult();
    scrollToCurrentResult();
  }
}

function clearSearchResults() {
  // Remove all highlight spans and restore original text
  searchResults.forEach(span => {
    const parent = span.parentNode;
    if (parent) {
      parent.replaceChild(document.createTextNode(span.textContent), span);
    }
  });
  
  // Normalize text nodes (merge adjacent text nodes)
  if (markdownContent) {
    markdownContent.normalize();
  }
  
  searchResults = [];
  currentResultIndex = -1;
  updateSearchCounter();
}

function navigateResults(direction) {
  if (searchResults.length === 0) return;
  
  // Clear current highlight
  if (currentResultIndex >= 0 && currentResultIndex < searchResults.length) {
    searchResults[currentResultIndex].classList.remove('search-highlight-current');
  }
  
  // Calculate new index
  currentResultIndex += direction;
  if (currentResultIndex >= searchResults.length) {
    currentResultIndex = 0;
  } else if (currentResultIndex < 0) {
    currentResultIndex = searchResults.length - 1;
  }
  
  // Highlight current result
  highlightCurrentResult();
  scrollToCurrentResult();
  updateSearchCounter();
}

function highlightCurrentResult() {
  if (currentResultIndex >= 0 && currentResultIndex < searchResults.length) {
    searchResults[currentResultIndex].classList.add('search-highlight-current');
  }
}

function scrollToCurrentResult() {
  if (currentResultIndex >= 0 && currentResultIndex < searchResults.length) {
    const element = searchResults[currentResultIndex];
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
  }
}

function updateSearchCounter() {
  if (searchDialog && searchDialog.counter) {
    if (searchResults.length > 0) {
      searchDialog.counter.textContent = `${currentResultIndex + 1}/${searchResults.length}`;
    } else {
      searchDialog.counter.textContent = searchTerm ? '0/0' : '';
    }
  }
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function openFile() {
  try {
    const filePath = await open({
      filters: [
        {
          name: 'Markdown',
          extensions: ['md', 'markdown', 'mdown', 'mkd']
        }
      ]
    });

    if (filePath) {
      await loadMarkdownFile(filePath);
    }
  } catch (error) {
    console.error('Error opening file:', error);
    alert('Failed to open file: ' + error.message);
  }
}

async function openSampleFile() {
  try {
    const sampleMarkdown = `# 📄 Welcome to Markdown Viewer

This comprehensive sample demonstrates **all implemented features** of our markdown viewer.

## ✨ Implemented Features

- ✅ **CommonMark Markdown Rendering** - Full CommonMark specification support
- ✅ **Syntax Highlighting** - 20+ programming languages with color coding
- ✅ **File Associations** - Double-click .md files to open
- ✅ **Drag & Drop Support** - Drop markdown files into the window
- ✅ **Auto-Reload File Watching** - Live updates when files change
- ✅ **Strikethrough** - ~~Cross out~~ text support
- ✅ **Tables** - Full table rendering with GitHub styling
- ✅ **Footnotes** - Reference-style footnotes[^1]
- ✅ **Task Lists** - Interactive checkboxes
- ✅ **Image Rendering** - Local and remote images with enhanced styling
- ✅ **Mermaid Diagrams** - Flowcharts, sequence diagrams, gantt charts, and more
- ✅ **HTML Export** - Export current document as standalone HTML
- 🔄 *More features in development...*

## 🎨 Text Formatting

### Basic Formatting
- *Italic text* using asterisks or _underscores_
- **Bold text** using double asterisks or __double underscores__
- ***Bold and italic*** combined formatting
- \`inline code\` with backticks
- ~~Strikethrough text~~ with double tildes

### Links and References
- [External link](https://github.com) to websites
- [Internal reference](#syntax-highlighting-examples) to sections
- <https://direct-url-links.com> for direct URLs

### Blockquotes
> This is a blockquote demonstrating styled text blocks.
> 
> > Nested blockquotes are also supported for multi-level citations.

## 📋 Lists and Organization

### Numbered Lists
1. First major feature
2. Second key capability
3. Third important function
   1. Sub-item 3.1
   2. Sub-item 3.2
4. Fourth main feature

### Bulleted Lists
- Primary feature
- Secondary feature
  - Sub-feature A
  - Sub-feature B
    - Deep nested item
- Tertiary feature

### Task Lists (Interactive)
- [x] ✅ Basic markdown rendering
- [x] ✅ Syntax highlighting 
- [x] ✅ File associations & drag/drop
- [x] ✅ Auto-reload file watching
- [x] ✅ Tables and footnotes
- [x] ✅ Strikethrough support
- [x] ✅ Image rendering with enhanced styling
- [x] ✅ HTML export functionality
- [x] ✅ Mermaid diagram support
- [ ] 📋 Table of contents sidebar
- [ ] 🔍 Find in page (Ctrl+F)
- [ ] 🖨️ Print to PDF support
- [ ] 🌙 Dark mode themes

## 📊 Table Support

Our table rendering follows GitHub markdown styling:

| Feature | Status | Language | Performance |
|---------|--------|----------|-------------|
| Syntax Highlighting | ✅ Complete | Rust + syntect | Excellent |
| Auto-reload | ✅ Complete | Rust + notify | Fast |
| Drag & Drop | ✅ Complete | JavaScript + Tauri | Instant |
| File Associations | ✅ Complete | Tauri config | Native |
| Tables | ✅ Complete | pulldown-cmark | Good |

### Alignment Examples
| Left Aligned | Center Aligned | Right Aligned |
|:-------------|:--------------:|--------------:|
| Left text    | Center text    | Right text    |
| More left    | More center    | More right    |

## 💻 Syntax Highlighting Examples

Our syntax highlighting supports 20+ programming languages with proper themes:

### JavaScript/TypeScript
\`\`\`javascript
// Modern JavaScript with ES6+ features
class MarkdownViewer {
    constructor(container) {
        this.container = container;
        this.watchers = new Map();
    }
    
    async loadFile(filePath) {
        const content = await invoke('read_markdown_file', { filePath });
        this.render(content);
        this.watchFile(filePath);
    }
    
    watchFile(filePath) {
        // Auto-reload implementation
        console.log(\`Watching: \${filePath}\`);
    }
}

// Arrow functions and destructuring
const viewer = new MarkdownViewer('#content');
const { loadFile, watchFile } = viewer;
\`\`\`

### Python
\`\`\`python
# Python with type hints and modern features
from typing import List, Dict, Optional
from pathlib import Path
import asyncio

class DocumentProcessor:
    def __init__(self, base_path: Path):
        self.base_path = base_path
        self.cache: Dict[str, str] = {}
    
    async def process_markdown(self, file_path: str) -> Optional[str]:
        """Process markdown file with syntax highlighting."""
        try:
            content = await self.read_file(file_path)
            return self.highlight_syntax(content)
        except FileNotFoundError:
            print(f"File not found: {file_path}")
            return None
    
    def highlight_syntax(self, content: str) -> str:
        # Syntax highlighting logic
        return f"<highlighted>{content}</highlighted>"

# Example usage
processor = DocumentProcessor(Path("./docs"))
result = asyncio.run(processor.process_markdown("README.md"))
\`\`\`

### Rust (Our Backend Language)
\`\`\`rust
// Rust code demonstrating Tauri backend
use tauri::{AppHandle, Emitter};
use notify::{Watcher, RecommendedWatcher, RecursiveMode};
use std::sync::{Arc, Mutex};

type WatcherState = Arc<Mutex<Option<RecommendedWatcher>>>;

#[tauri::command]
async fn parse_markdown(content: &str) -> Result<String, String> {
    let syntax_set = syntect::parsing::SyntaxSet::load_defaults_newlines();
    let theme_set = syntect::highlighting::ThemeSet::load_defaults();
    
    // Parse markdown with syntax highlighting
    let parser = pulldown_cmark::Parser::new_ext(content, options);
    let mut html_output = String::new();
    pulldown_cmark::html::push_html(&mut html_output, parser);
    
    Ok(post_process_syntax_highlighting(&html_output))
}

#[tauri::command]
fn start_watching_file(
    file_path: String,
    app_handle: AppHandle,
    watcher_state: tauri::State<WatcherState>,
) -> Result<(), String> {
    // File watching implementation with notify crate
    println!("Starting to watch: {}", file_path);
    Ok(())
}
\`\`\`

### HTML/CSS
\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Markdown Viewer</title>
    <style>
        /* GitHub-style markdown CSS */
        .markdown-body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial;
            line-height: 1.6;
            color: #24292e;
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
        }
        
        .syntax-highlight {
            background: #f6f8fa;
            border-radius: 6px;
            padding: 16px;
            overflow-x: auto;
        }
        
        table {
            border-collapse: collapse;
            margin: 1rem 0;
        }
        
        td, th {
            border: 1px solid #d0d7de;
            padding: 6px 13px;
        }
    </style>
</head>
<body class="markdown-body">
    <div id="content"></div>
</body>
</html>
\`\`\`

### SQL
\`\`\`sql
-- Complex SQL query with CTEs and window functions
WITH monthly_sales AS (
    SELECT 
        DATE_TRUNC('month', order_date) as month,
        customer_id,
        SUM(amount) as monthly_total,
        COUNT(*) as order_count
    FROM orders 
    WHERE order_date >= '2024-01-01'
    GROUP BY 1, 2
),
customer_rankings AS (
    SELECT 
        customer_id,
        month,
        monthly_total,
        ROW_NUMBER() OVER (PARTITION BY month ORDER BY monthly_total DESC) as rank,
        LAG(monthly_total) OVER (PARTITION BY customer_id ORDER BY month) as prev_month
    FROM monthly_sales
)
SELECT 
    c.customer_name,
    cr.month,
    cr.monthly_total,
    cr.rank,
    CASE 
        WHEN cr.prev_month IS NULL THEN 'New Customer'
        WHEN cr.monthly_total > cr.prev_month THEN 'Growing'
        ELSE 'Declining'
    END as trend
FROM customer_rankings cr
JOIN customers c ON cr.customer_id = c.id
WHERE cr.rank <= 10
ORDER BY cr.month, cr.rank;
\`\`\`

### JSON Configuration
\`\`\`json
{
  "name": "markdown-viewer",
  "version": "0.1.0",
  "description": "A Tauri-based markdown viewer with syntax highlighting",
  "dependencies": {
    "pulldown-cmark": "0.9",
    "syntect": "5.0",
    "notify": "6.0",
    "tauri": "2.0"
  },
  "features": {
    "syntax_highlighting": true,
    "file_watching": true,
    "drag_drop": true,
    "file_associations": true,
    "tables": true,
    "footnotes": true,
    "strikethrough": true
  },
  "supported_languages": [
    "javascript", "typescript", "python", "rust", "html", "css", 
    "sql", "json", "yaml", "bash", "markdown", "c", "cpp", "java",
    "go", "php", "ruby", "swift", "kotlin", "scala", "haskell"
  ]
}
\`\`\`

### Shell/Bash
\`\`\`bash
#!/bin/bash
# Build script for Markdown Viewer

set -e  # Exit on any error

echo "🚀 Building Markdown Viewer..."

# Check if Rust is installed
if ! command -v cargo &> /dev/null; then
    echo "❌ Rust is not installed. Please install Rust first."
    exit 1
fi

# Check if Node.js is installed  
if ! command -v npm &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the application
echo "🔨 Building application..."
npm run tauri build

echo "✅ Build complete! Check the 'src-tauri/target/release/bundle' directory."

# Optional: Create distribution package
if [ "$1" = "--package" ]; then
    echo "📦 Creating distribution package..."
    mkdir -p dist
    cp -r src-tauri/target/release/bundle/* dist/
    echo "✅ Distribution package created in 'dist/' directory."
fi
\`\`\`

## 📝 Footnotes and References

This markdown viewer supports footnotes[^1] and multiple reference styles[^note].

You can reference the same footnote multiple times[^1] throughout your document.

## 🖼️ Image Rendering

Our enhanced image rendering supports both local and remote images:

### Remote Images
![Sample Test Image](https://httpbin.org/image/png)

### Different Image Sizes
- JPEG sample: ![JPEG Test](https://httpbin.org/image/jpeg)  
- WebP sample: ![WebP Test](https://httpbin.org/image/webp)

### Image Features
- **Responsive scaling**: Images automatically fit the container width
- **Enhanced styling**: Rounded corners and subtle shadows
- **Local image support**: Reference images relative to your markdown file
- **Alt text support**: Screen reader friendly with proper alt text
- **Multiple formats**: Works with PNG, JPG, GIF, WebP, and SVG

## 📤 Export Functionality

The **Export HTML** button (visible when viewing content) allows you to:
- Generate standalone HTML files with embedded CSS
- Preserve all formatting, syntax highlighting, and styling
- Include images and tables in the exported document
- Create files that work offline without external dependencies

Simply click "Export HTML" in the toolbar and choose where to save your file!

## 🚀 How to Use All Features

### File Operations
1. **Open files**: Drag & drop .md files into the window
2. **File associations**: Double-click .md files in your file manager
3. **Auto-reload**: Edit files in your editor and see changes instantly
4. **Export**: Click "Export HTML" to save as standalone HTML file

### Testing Syntax Highlighting
- Create code blocks with \`\`\`language
- Supported: js, ts, py, rs, html, css, sql, json, bash, and more
- The viewer automatically detects and highlights syntax

### Working with Tables
- Use pipe \`|\` characters to create table columns
- Add \`:---\` for left align, \`:---:\` for center, \`---:\` for right align
- Tables automatically get GitHub-style CSS formatting

### Working with Images
- Use \`![alt text](image-url)\` for images
- Local images: \`![description](./relative/path.png)\`
- Remote images: \`![description](https://example.com/image.jpg)\`
- Images automatically scale to fit the content area

### Advanced Features
- **Strikethrough**: Use \`~~text~~\` for ~~strikethrough~~
- **Task lists**: Use \`- [ ]\` for unchecked, \`- [x]\` for checked
- **Footnotes**: Use \`[^label]\` for references and \`[^label]: text\` for definitions

## 📊 Mermaid Diagram Support

Our markdown viewer now supports **Mermaid diagrams** for creating flowcharts, sequence diagrams, and more!

### Flowchart Example
\`\`\`mermaid
graph TD
    A[Open Markdown File] --> B{File Valid?}
    B -->|Yes| C[Parse Content]
    B -->|No| D[Show Error]
    C --> E[Render HTML]
    E --> F[Process Mermaid Diagrams]
    F --> G[Display Result]
    D --> H[End]
    G --> H
\`\`\`

### Sequence Diagram
\`\`\`mermaid
sequenceDiagram
    participant User
    participant App
    participant FileSystem
    participant Mermaid
    
    User->>App: Open File
    App->>FileSystem: Read Markdown
    FileSystem->>App: Return Content
    App->>Mermaid: Process Diagrams
    Mermaid->>App: Return SVG
    App->>User: Display Rendered Content
\`\`\`

### Development Timeline
\`\`\`mermaid
gantt
    title Markdown Viewer Development
    dateFormat  YYYY-MM-DD
    section Core Features
    Project Setup       :done, setup, 2024-01-01, 2d
    Basic Rendering     :done, basic, after setup, 5d
    Syntax Highlighting :done, syntax, after basic, 4d
    File Watching      :done, watch, after syntax, 4d
    section File Operations
    Drag and Drop      :done, dragdrop, after watch, 3d
    File Associations  :done, assoc, after dragdrop, 2d
    Auto Reload        :done, reload, after assoc, 3d
    section Content Support
    Table Rendering    :done, tables, after reload, 3d
    Image Support      :done, images, after tables, 3d
    Footnotes         :done, footnotes, after images, 2d
    section Advanced Features
    Mermaid Diagrams   :active, mermaid, after footnotes, 4d
    HTML Export        :done, export, after mermaid, 3d
    Find in Page       :search, after export, 5d
    Print to PDF       :pdf, after search, 4d
\`\`\`

---

*This markdown viewer is built with Tauri (Rust) + Vanilla JavaScript, featuring real-time file watching, comprehensive markdown support, beautiful syntax highlighting, and interactive Mermaid diagrams.*

[^1]: This is the first footnote with detailed explanation.
[^note]: Another footnote showing multiple reference support.`;

    await loadMarkdownContent(sampleMarkdown);
  } catch (error) {
    console.error('Error opening sample file:', error);
    alert('Failed to load sample content: ' + error.message);
  }
}

async function loadMarkdownContent(markdownText, fileName = 'Sample') {
  try {
    // Stop watching previous file since this is content-based
    if (currentFilePath) {
      await stopWatchingFile();
      currentFilePath = null;
    }
    
    // Clear search if active
    if (isSearchDialogVisible) {
      hideSearchDialog();
    }
    
    // Show loading state
    markdownContent.innerHTML = '<div style="text-align: center; padding: 2rem;">Loading...</div>';
    welcomeScreen.style.display = 'none';
    markdownViewer.style.display = 'block';

    // Call Tauri command to parse markdown
    const htmlContent = await invoke('parse_markdown', { markdownContent: markdownText });
    
    // Store current content for export
    currentMarkdownContent = htmlContent;
    currentTitle = fileName;
    
    // Display the parsed HTML
    markdownContent.innerHTML = htmlContent;
    
    // Add image error handling
    setupImageErrorHandling();
    
    // Process Mermaid diagrams
    await processMermaidDiagrams();
    
    // Show export button
    exportHtmlBtn.style.display = 'inline-block';
    
    // Update window title
    document.title = `Markdown Viewer - ${fileName}`;
    
  } catch (error) {
    console.error('Error loading markdown content:', error);
    markdownContent.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: #dc3545;">
        <h3>Error Loading Content</h3>
        <p>${error}</p>
      </div>
    `;
  }
}


async function loadMarkdownFile(filePath) {
  try {
    // Stop watching previous file
    if (currentFilePath) {
      await stopWatchingFile();
    }
    
    // Clear search if active
    if (isSearchDialogVisible) {
      hideSearchDialog();
    }
    
    // Show loading state
    markdownContent.innerHTML = '<div style="text-align: center; padding: 2rem;">Loading...</div>';
    welcomeScreen.style.display = 'none';
    markdownViewer.style.display = 'block';

    // Call Tauri command to read and parse markdown
    const htmlContent = await invoke('read_markdown_file', { filePath });
    
    // Store current content for export
    currentMarkdownContent = htmlContent;
    currentTitle = filePath.split(/[\\/]/).pop();
    
    // Display the parsed HTML
    markdownContent.innerHTML = htmlContent;
    currentFilePath = filePath;
    
    // Add image error handling
    setupImageErrorHandling();
    
    // Process Mermaid diagrams
    await processMermaidDiagrams();
    
    // Show export button
    exportHtmlBtn.style.display = 'inline-block';
    
    // Update window title
    document.title = `Markdown Viewer - ${currentTitle}`;
    
    // Start watching the file for changes
    await startWatchingFile(filePath);
    
  } catch (error) {
    console.error('Error loading markdown file:', error);
    markdownContent.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: #dc3545;">
        <h3>Error Loading File</h3>
        <p>${error}</p>
      </div>
    `;
  }
}

async function checkLaunchArgs() {
  try {
    const args = await invoke('get_launch_args');
    console.log('Launch args:', args);
    
    // Look for markdown file in arguments (skip first arg which is the executable)
    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      if (arg.match(/\.(md|markdown|mdown|mkd)$/i)) {
        console.log('Found markdown file in args:', arg);
        await loadMarkdownFile(arg);
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error('Error checking launch args:', error);
    return false;
  }
}

async function setupDragAndDrop() {
  console.log('Setting up drag and drop...');
  
  try {
    // Check if we're in a Tauri environment first
    if (!window.__TAURI__) {
      console.log('❌ Not in Tauri environment, drag and drop not available');
      return;
    }
    
    // Use the correct Tauri v2 API path based on documentation
    let webview;
    
    // Try the documented approaches for Tauri v2
    if (window.__TAURI__.webviewWindow && window.__TAURI__.webviewWindow.getCurrentWebviewWindow) {
      // This is the correct path for Tauri v2
      webview = window.__TAURI__.webviewWindow.getCurrentWebviewWindow();
      console.log('✅ Using window.__TAURI__.webviewWindow.getCurrentWebviewWindow()');
    } else if (window.__TAURI__.window && window.__TAURI__.window.getCurrentWindow) {
      // Fallback to window API
      webview = window.__TAURI__.window.getCurrentWindow();
      console.log('✅ Using window.__TAURI__.window.getCurrentWindow() as fallback');
    } else {
      throw new Error('No webview/window API found in available Tauri APIs');
    }
    console.log('Current webview:', webview);
    console.log('Available webview methods:', Object.getOwnPropertyNames(webview));
    
    // Use standard listen method for drag and drop events based on documentation patterns
    const possibleEvents = [
      'tauri://file-drop',
      'tauri://file-drop-hover', 
      'tauri://file-drop-cancelled',
      'tauri://drag-drop',
      'tauri://drag-enter',
      'tauri://drag-over', 
      'tauri://drag-leave',
      'file-drop',
      'drag-drop',
      'drop',
      'file-dropped'
    ];
    
    const app = document.querySelector('.app');
    let setupCount = 0;
    
    // Try to listen to all possible drag/drop events
    for (const eventName of possibleEvents) {
      try {
        const unlisten = await webview.listen(eventName, (event) => {
          console.log(`✅ Event "${eventName}" triggered!`, event);
          
          if (eventName.includes('hover') || eventName.includes('enter') || eventName.includes('over')) {
            app.classList.add('drag-over');
          } else if (eventName.includes('cancelled') || eventName.includes('leave')) {
            app.classList.remove('drag-over');
          } else {
            // File drop event
            app.classList.remove('drag-over');
            
            let droppedFiles = [];
            if (event.payload && Array.isArray(event.payload)) {
              droppedFiles = event.payload;
            } else if (event.payload && event.payload.paths) {
              droppedFiles = event.payload.paths;
            } else if (event.payload) {
              droppedFiles = [event.payload];
            } else if (event.paths) {
              droppedFiles = event.paths;
            }
            
            console.log('Dropped file paths:', droppedFiles);
            
            // Find the first markdown file
            const markdownFile = droppedFiles.find(filePath => 
              filePath && typeof filePath === 'string' && filePath.match(/\.(md|markdown|mdown|mkd)$/i)
            );
            
            if (markdownFile) {
              console.log('Loading markdown file:', markdownFile);
              loadMarkdownFile(markdownFile);
            } else if (droppedFiles.length > 0) {
              console.log('Non-markdown files dropped:', droppedFiles);
              alert('Please drop a markdown file (.md, .markdown, .mdown, .mkd)');
            }
          }
        });
        
        console.log(`✅ Successfully listening to: ${eventName}`);
        setupCount++;
        
      } catch (error) {
        console.log(`⚠️ Could not listen to "${eventName}":`, error.message);
      }
    }
    
    console.log('✅ Drag and drop event listener set up successfully');
    
    // Store the unlisten function for cleanup if needed
    window.dragDropUnlisten = unlisten;
    
  } catch (error) {
    console.error('❌ Error setting up drag and drop:', error);
    console.log('Available Tauri APIs:', Object.keys(window.__TAURI__ || {}));
    
    // Fallback: try native drag and drop events
    try {
      console.log('🔄 Setting up native drag and drop fallback...');
      const app = document.querySelector('.app');
      
      app.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        app.classList.add('drag-over');
        console.log('Native dragover');
      });
      
      app.addEventListener('dragleave', (e) => {
        e.preventDefault();
        if (!app.contains(e.relatedTarget)) {
          app.classList.remove('drag-over');
          console.log('Native dragleave');
        }
      });
      
      app.addEventListener('drop', async (e) => {
        e.preventDefault();
        app.classList.remove('drag-over');
        console.log('Native drop event', e.dataTransfer.files);
        
        const files = Array.from(e.dataTransfer.files);
        const markdownFile = files.find(file => 
          file.name.match(/\.(md|markdown|mdown|mkd)$/i)
        );
        
        if (markdownFile) {
          // For native file API, read the content directly
          const content = await markdownFile.text();
          const htmlContent = await invoke('parse_markdown', { markdownContent: content });
          
          // Stop watching previous file
          if (currentFilePath) {
            await stopWatchingFile();
            currentFilePath = null;
          }
          
          // Show content
          welcomeScreen.style.display = 'none';
          markdownViewer.style.display = 'block';
          markdownContent.innerHTML = htmlContent;
          document.title = `Markdown Viewer - ${markdownFile.name}`;
          
          console.log('✅ Loaded dropped file via native API');
        } else if (files.length > 0) {
          alert('Please drop a markdown file (.md, .markdown, .mdown, .mkd)');
        }
      });
      
      console.log('✅ Native drag and drop fallback set up');
      
    } catch (fallbackError) {
      console.error('❌ Fallback drag and drop setup also failed:', fallbackError);
    }
  }
}

async function startWatchingFile(filePath) {
  try {
    await invoke('start_watching_file', { filePath });
    console.log('Started watching file:', filePath);
  } catch (error) {
    console.error('Error starting file watcher:', error);
  }
}

async function stopWatchingFile() {
  try {
    await invoke('stop_watching_file');
    console.log('Stopped watching file');
  } catch (error) {
    console.error('Error stopping file watcher:', error);
  }
}

async function handleFileChange(filePath) {
  console.log('File changed:', filePath);
  if (filePath === currentFilePath) {
    // Reload the file content
    await loadMarkdownFile(filePath);
  }
}

function initializeMermaid() {
  if (!window.mermaid || mermaidInitialized) return;
  
  try {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
      htmlLabels: true,
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true
      },
      sequence: {
        useMaxWidth: true,
        wrap: true
      },
      gantt: {
        useMaxWidth: true
      }
    });
    mermaidInitialized = true;
    console.log('✅ Mermaid initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing Mermaid:', error);
  }
}

async function processMermaidDiagrams() {
  if (!window.mermaid) {
    console.log('⚠️ Mermaid not available, skipping diagram processing');
    return;
  }
  
  // Initialize Mermaid if not done already
  initializeMermaid();
  
  try {
    // Find all code blocks with mermaid class
    const mermaidBlocks = markdownContent.querySelectorAll('code.language-mermaid, pre code.language-mermaid');
    console.log(`Found ${mermaidBlocks.length} Mermaid diagram(s)`);
    
    for (let i = 0; i < mermaidBlocks.length; i++) {
      const block = mermaidBlocks[i];
      const diagramText = block.textContent;
      const diagramId = `mermaid-diagram-${Date.now()}-${i}`;
      
      try {
        // Create a container div for the diagram
        const container = document.createElement('div');
        container.className = 'mermaid-diagram-container';
        container.style.textAlign = 'center';
        container.style.margin = '1rem 0';
        
        // Render the diagram
        const { svg } = await mermaid.render(diagramId, diagramText);
        container.innerHTML = svg;
        
        // Replace the code block with the rendered diagram
        const preElement = block.closest('pre') || block;
        preElement.parentNode.replaceChild(container, preElement);
        
        console.log(`✅ Rendered Mermaid diagram ${i + 1}`);
        
      } catch (error) {
        console.error(`❌ Error rendering Mermaid diagram ${i + 1}:`, error);
        
        // Create error fallback
        const errorDiv = document.createElement('div');
        errorDiv.style.border = '2px dashed #dc3545';
        errorDiv.style.borderRadius = '0.5rem';
        errorDiv.style.padding = '1rem';
        errorDiv.style.margin = '1rem 0';
        errorDiv.style.background = '#f8f9fa';
        errorDiv.style.color = '#dc3545';
        errorDiv.innerHTML = `
          <div style="font-weight: bold;">📊 Mermaid Diagram Error</div>
          <div style="font-size: 0.875rem; margin-top: 0.5rem;">Failed to render diagram</div>
          <div style="font-size: 0.75rem; margin-top: 0.25rem; color: #6c757d;">${error.message}</div>
          <details style="margin-top: 0.5rem;">
            <summary style="cursor: pointer;">Show diagram source</summary>
            <pre style="background: #fff; padding: 0.5rem; margin-top: 0.5rem; border-radius: 0.25rem; overflow-x: auto;"><code>${diagramText}</code></pre>
          </details>
        `;
        
        const preElement = block.closest('pre') || block;
        preElement.parentNode.replaceChild(errorDiv, preElement);
      }
    }
    
  } catch (error) {
    console.error('❌ Error processing Mermaid diagrams:', error);
  }
}

function setupImageErrorHandling() {
  const images = markdownContent.querySelectorAll('img');
  images.forEach(img => {
    img.addEventListener('error', function() {
      console.warn('Image failed to load:', img.src);
      
      // Add error styling
      img.style.border = '2px dashed #dc3545';
      img.style.padding = '1rem';
      img.style.background = '#f8f9fa';
      img.style.color = '#dc3545';
      
      // Create fallback content
      const fallback = document.createElement('div');
      fallback.style.textAlign = 'center';
      fallback.style.padding = '2rem';
      fallback.style.border = '2px dashed #dc3545';
      fallback.style.borderRadius = '0.5rem';
      fallback.style.background = '#f8f9fa';
      fallback.style.color = '#dc3545';
      fallback.innerHTML = `
        <div>📷 Image failed to load</div>
        <div style="font-size: 0.875rem; margin-top: 0.5rem;">${img.alt || 'No description'}</div>
        <div style="font-size: 0.75rem; margin-top: 0.25rem; color: #6c757d;">${img.src}</div>
      `;
      
      // Replace the image with the fallback
      img.parentNode.replaceChild(fallback, img);
    });
    
    img.addEventListener('load', function() {
      console.log('Image loaded successfully:', img.src);
    });
  });
}

async function exportHtml() {
  try {
    console.log('Export function called');
    console.log('Current content available:', !!currentMarkdownContent);
    console.log('Current title:', currentTitle);
    
    if (!currentMarkdownContent) {
      alert('No content to export. Please load a markdown file first.');
      return;
    }

    // Generate filename based on current title
    const defaultName = currentTitle.replace(/\.(md|markdown|mdown|mkd)$/i, '') + '.html';
    console.log('Default filename:', defaultName);
    
    console.log('Opening save dialog...');
    const filePath = await save({
      title: 'Export HTML',
      defaultPath: defaultName,
      filters: [
        {
          name: 'HTML',
          extensions: ['html']
        }
      ]
    });

    console.log('Selected file path:', filePath);

    if (filePath) {
      console.log('Generating HTML document...');
      // Generate complete HTML document
      const htmlDocument = await invoke('export_html', { 
        content: currentMarkdownContent, 
        title: currentTitle 
      });
      
      console.log('HTML document generated, length:', htmlDocument.length);
      
      // Write the HTML file using Tauri's fs plugin
      console.log('Writing file...');
      await writeTextFile(filePath, htmlDocument);
      
      console.log('File written successfully');
      alert(`HTML exported successfully to: ${filePath}`);
    } else {
      console.log('No file path selected');
    }
  } catch (error) {
    console.error('Error exporting HTML:', error);
    console.error('Error details:', error.message, error.stack);
    alert('Failed to export HTML: ' + error.message);
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  console.log('🚀 DOM Content Loaded');
  console.log('🔍 Checking Tauri availability...');
  console.log('window.__TAURI__:', !!window.__TAURI__);
  console.log('window.__TAURI__.event:', !!window.__TAURI__?.event);
  console.log('window.__TAURI__.window:', !!window.__TAURI__?.window);
  console.log('window.__TAURI__.webview:', !!window.__TAURI__?.webview);
  console.log('window.__TAURI__.core:', !!window.__TAURI__?.core);
  
  // Get DOM elements
  openFileBtn = document.querySelector('#open-file-btn');
  fileInput = document.querySelector('#file-input');
  welcomeScreen = document.querySelector('#welcome-screen');
  markdownViewer = document.querySelector('#markdown-viewer');
  markdownContent = document.querySelector('#markdown-content');
  exportHtmlBtn = document.querySelector('#export-html-btn');

  // Setup event listeners
  openFileBtn.addEventListener('click', openFile);
  document.querySelector('#sample-btn').addEventListener('click', openSampleFile);
  exportHtmlBtn.addEventListener('click', exportHtml);
  
  // Global keyboard shortcuts
  document.addEventListener('keydown', (event) => {
    // Ctrl+F for find in page
    if (event.ctrlKey && event.key === 'f') {
      event.preventDefault();
      showSearchDialog();
    }
    // Escape to close search dialog
    else if (event.key === 'Escape' && isSearchDialogVisible) {
      event.preventDefault();
      hideSearchDialog();
    }
  });
  
  // Add manual drag and drop debugging
  const app = document.querySelector('.app');
  app.addEventListener('dragenter', (e) => {
    console.log('🎯 Native dragenter event', e);
  });
  app.addEventListener('dragover', (e) => {
    console.log('🎯 Native dragover event', e);
  });
  app.addEventListener('drop', (e) => {
    console.log('🎯 Native drop event', e);
    console.log('🎯 Files in drop:', e.dataTransfer?.files);
  });
  
  // Setup drag and drop with await
  await setupDragAndDrop();
  
  // Listen for file change events from Rust backend
  const { listen } = window.__TAURI__.event;
  await listen('file-changed', (event) => {
    handleFileChange(event.payload);
  });
  
  // Check for file associations (launch arguments)
  const foundFile = await checkLaunchArgs();
  
  // If no file was passed via launch args, show welcome screen
  if (!foundFile) {
    isInitialized = true;
  }
});
