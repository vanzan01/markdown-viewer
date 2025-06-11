# UI/UX Implementation Guide

## Design Principles (from PRD)

### Core Philosophy
- **Viewer, not editor** - Read-only interface design
- **PDF-like experience** - Simple, focused, no distractions  
- **Zero configuration** - Works immediately without setup
- **GitHub-style familiar** - Recognizable markdown styling

## Layout Structure

### Main Window Layout
```
┌─────────────────────────────────────────┐
│ [☰] Markdown Viewer    [🔍] [⚙️] [×]   │ ← Title bar
├─────────────────────────────────────────┤
│ File: README.md                    [↻]  │ ← File info bar
├─────────┬───────────────────────────────┤
│ ## TOC  │ # Document Title              │
│ - Intro │                               │ 
│ - Setup │ This is the markdown content  │
│ - Usage │ rendered with GitHub styling. │
│         │                               │
│         │ ```javascript                 │
│         │ console.log('hello');         │
│         │ ```                           │
│         │                               │
└─────────┴───────────────────────────────┘
```

### Responsive Behavior
- **TOC Sidebar**: 200px fixed width, collapsible on small screens
- **Content Area**: Flexible width, max 800px for readability
- **Minimum Window**: 400x300px

## Component Implementation

### 1. Title Bar (Vanilla JS Implementation)
**See VANILLA_JS_PATTERNS.md for complete implementation**

```html
<!-- HTML Structure -->
<div class="title-bar">
    <div class="title-section">
        <span class="app-icon">📄</span>
        <span class="app-name">Markdown Viewer</span>
    </div>
    <div class="controls">
        <button id="reload-btn" title="Reload file">↻</button>
        <button id="settings-btn" title="Settings">⚙️</button>
    </div>
</div>
```

```javascript
// JavaScript Event Handling
document.getElementById('reload-btn').addEventListener('click', () => {
    if (window.markdownViewer.currentFile) {
        window.markdownViewer.reloadCurrentFile();
    }
});
```

### 2. Table of Contents (Vanilla JS Implementation)
**See VANILLA_JS_PATTERNS.md for complete TableOfContents class**

```html
<!-- HTML Structure -->
<nav id="toc-sidebar" class="toc-sidebar">
    <h3>Contents</h3>
    <ul id="toc-list">
        <!-- TOC items generated dynamically -->
    </ul>
</nav>
```

```javascript
// Dynamic TOC Generation (simplified example)
function generateTOC(headers) {
    const tocList = document.getElementById('toc-list');
    tocList.innerHTML = headers.map(header => `
        <li class="${currentSection === header.id ? 'active' : ''}">
            <a href="#${header.id}" style="padding-left: ${header.level * 12}px">
                ${header.text}
            </a>
        </li>
    `).join('');
}
```

### 3. Content Viewer (Vanilla JS Implementation)
**See VANILLA_JS_PATTERNS.md for complete ContentViewer class**

```html
<!-- HTML Structure -->
<main id="content-viewer" class="content-viewer">
    <article id="markdown-content" class="markdown-content">
        <!-- Markdown content rendered here -->
    </article>
</main>
```

```javascript
// Content rendering
function renderMarkdownContent(htmlContent) {
    const contentElement = document.getElementById('markdown-content');
    contentElement.innerHTML = htmlContent;
    
    // Setup scroll listener
    document.getElementById('content-viewer').addEventListener('scroll', handleScroll);
}
```

## CSS Implementation (src/styles.css)

### GitHub-Style Theme
```css
/* Base GitHub styling */
.markdown-content {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 16px;
    line-height: 1.6;
    color: #24292f;
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
}

.markdown-content h1, .markdown-content h2, .markdown-content h3 {
    border-bottom: 1px solid #d0d7de;
    padding-bottom: 8px;
    margin-top: 24px;
    margin-bottom: 16px;
}

.markdown-content code {
    background-color: #f6f8fa;
    border-radius: 6px;
    font-size: 85%;
    margin: 0;
    padding: 0.2em 0.4em;
}

.markdown-content pre {
    background-color: #f6f8fa;
    border-radius: 6px;
    font-size: 85%;
    line-height: 1.45;
    overflow: auto;
    padding: 16px;
}

.markdown-content blockquote {
    border-left: 0.25em solid #d0d7de;
    color: #656d76;
    padding: 0 1em;
    margin: 0;
}

.markdown-content table {
    border-collapse: collapse;
    border-spacing: 0;
    display: block;
    width: max-content;
    max-width: 100%;
    overflow: auto;
}

.markdown-content table th,
.markdown-content table td {
    border: 1px solid #d0d7de;
    padding: 6px 13px;
}

.markdown-content table th {
    background-color: #f6f8fa;
    font-weight: 600;
}
```

### Layout CSS
```css
/* Application layout */
.app-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: #ffffff;
}

.title-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 16px;
    background: #f6f8fa;
    border-bottom: 1px solid #d0d7de;
    min-height: 40px;
}

.main-content {
    display: flex;
    flex: 1;
    overflow: hidden;
}

.toc-sidebar {
    width: 200px;
    background: #f6f8fa;
    border-right: 1px solid #d0d7de;
    overflow-y: auto;
    padding: 16px;
}

.content-viewer {
    flex: 1;
    overflow-y: auto;
    background: #ffffff;
}

/* Responsive design */
@media (max-width: 768px) {
    .toc-sidebar {
        position: absolute;
        left: -200px;
        transition: left 0.3s ease;
        z-index: 100;
        height: 100%;
    }
    
    .toc-sidebar.open {
        left: 0;
    }
}
```

## Interaction Patterns

### File Loading States
```javascript
// Loading indicator
function LoadingState() {
    return (
        <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading markdown file...</p>
        </div>
    );
}

// Error state
function ErrorState({ error, onRetry }) {
    return (
        <div className="error-state">
            <h2>Failed to load file</h2>
            <p>{error}</p>
            <button onClick={onRetry}>Try Again</button>
        </div>
    );
}
```

### Drag & Drop Visual Feedback
```css
.drop-zone {
    border: 2px dashed #d0d7de;
    border-radius: 6px;
    padding: 40px;
    text-align: center;
    color: #656d76;
    transition: all 0.2s ease;
}

.drop-zone.drag-over {
    border-color: #0969da;
    background-color: #f0f8ff;
    color: #0969da;
}
```

### Scroll Sync (TOC highlighting)
```javascript
function useScrollSync() {
    const [activeSection, setActiveSection] = useState('');
    
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        setActiveSection(entry.target.id);
                    }
                });
            },
            { rootMargin: '-10% 0px -85% 0px' }
        );
        
        document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(
            heading => observer.observe(heading)
        );
        
        return () => observer.disconnect();
    }, []);
    
    return activeSection;
}
```

## Accessibility Guidelines

### Keyboard Navigation
- **Tab**: Navigate between UI elements
- **Ctrl+F**: Open find dialog
- **Ctrl+Plus/Minus**: Zoom in/out
- **F11**: Toggle fullscreen
- **Escape**: Close dialogs/menus

### Screen Reader Support
```html
<!-- Semantic HTML structure -->
<main role="main" aria-label="Markdown content">
    <nav role="navigation" aria-label="Table of contents">
        <!-- TOC content -->
    </nav>
    <article aria-label="Markdown document">
        <!-- Rendered content -->
    </article>
</main>
```

### Color Contrast
- Text: #24292f on #ffffff (AAA rated)
- Links: #0969da (AA rated)
- Secondary text: #656d76 (AA rated)

## Print Styles

```css
@media print {
    .title-bar,
    .toc-sidebar {
        display: none;
    }
    
    .content-viewer {
        width: 100% !important;
        margin: 0;
        padding: 0;
    }
    
    .markdown-content {
        max-width: none;
        font-size: 12pt;
        line-height: 1.4;
    }
    
    /* Page break handling */
    .markdown-content h1,
    .markdown-content h2 {
        page-break-before: always;
    }
    
    .markdown-content pre,
    .markdown-content table {
        page-break-inside: avoid;
    }
}