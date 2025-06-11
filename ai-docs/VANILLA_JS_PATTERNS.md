# Vanilla JS Implementation Patterns

## Project Architecture Note
This project uses **vanilla HTML/CSS/JavaScript** (not React/Vue) to maintain simplicity and minimize bundle size per PRD requirements.

## Vanilla JS Component Patterns

### 1. Table of Contents Implementation
```javascript
// src/components/toc.js
class TableOfContents {
    constructor(container) {
        this.container = container;
        this.headers = [];
        this.currentSection = '';
    }
    
    generateTOC(headers) {
        this.headers = headers;
        this.render();
        this.setupScrollSync();
    }
    
    render() {
        const tocHTML = `
            <nav class="toc-sidebar">
                <h3>Contents</h3>
                <ul>
                    ${this.headers.map(header => `
                        <li class="${this.currentSection === header.id ? 'active' : ''}">
                            <a href="#${header.id}" 
                               style="padding-left: ${header.level * 12}px">
                                ${header.text}
                            </a>
                        </li>
                    `).join('')}
                </ul>
            </nav>
        `;
        this.container.innerHTML = tocHTML;
    }
    
    setupScrollSync() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.updateActiveSection(entry.target.id);
                }
            });
        }, { rootMargin: '-10% 0px -85% 0px' });
        
        document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(
            heading => observer.observe(heading)
        );
    }
    
    updateActiveSection(sectionId) {
        this.currentSection = sectionId;
        this.render();
    }
}
```

### 2. Markdown Content Viewer
```javascript
// src/components/content-viewer.js
class ContentViewer {
    constructor(container) {
        this.container = container;
        this.currentFile = null;
    }
    
    async loadMarkdownFile(filePath) {
        try {
            this.showLoading();
            const content = await invoke('read_markdown_file', { path: filePath });
            const html = await invoke('parse_markdown', { content });
            this.renderContent(html);
            this.currentFile = filePath;
        } catch (error) {
            this.showError('Failed to load file: ' + error);
        }
    }
    
    renderContent(html) {
        this.container.innerHTML = `
            <main class="content-viewer">
                <article class="markdown-content">
                    ${html}
                </article>
            </main>
        `;
        this.setupImageHandling();
        this.setupLinkHandling();
    }
    
    showLoading() {
        this.container.innerHTML = `
            <div class="loading-state">
                <div class="spinner"></div>
                <p>Loading markdown file...</p>
            </div>
        `;
    }
    
    showError(message) {
        this.container.innerHTML = `
            <div class="error-state">
                <h2>Failed to load file</h2>
                <p>${message}</p>
                <button onclick="this.retry()">Try Again</button>
            </div>
        `;
    }
    
    setupImageHandling() {
        const images = this.container.querySelectorAll('img');
        images.forEach(img => {
            img.addEventListener('error', () => {
                img.alt = 'Failed to load image';
                img.classList.add('broken-image');
            });
        });
    }
    
    setupLinkHandling() {
        const links = this.container.querySelectorAll('a[href^="http"]');
        links.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                invoke('open_external_link', { url: link.href });
            });
        });
    }
}
```

### 3. Application State Management
```javascript
// src/state/app-state.js
class AppState {
    constructor() {
        this.currentFile = null;
        this.recentFiles = this.loadRecentFiles();
        this.zoomLevel = 100;
        this.searchTerm = '';
        this.settings = this.loadSettings();
    }
    
    setCurrentFile(filePath) {
        this.currentFile = filePath;
        this.addToRecentFiles(filePath);
        this.notifyStateChange('currentFile', filePath);
    }
    
    addToRecentFiles(filePath) {
        this.recentFiles = this.recentFiles.filter(f => f !== filePath);
        this.recentFiles.unshift(filePath);
        this.recentFiles = this.recentFiles.slice(0, 10); // Keep max 10
        this.saveRecentFiles();
        this.notifyStateChange('recentFiles', this.recentFiles);
    }
    
    setZoomLevel(level) {
        this.zoomLevel = Math.max(50, Math.min(200, level));
        this.notifyStateChange('zoomLevel', this.zoomLevel);
    }
    
    loadRecentFiles() {
        try {
            return JSON.parse(localStorage.getItem('recentFiles') || '[]');
        } catch {
            return [];
        }
    }
    
    saveRecentFiles() {
        localStorage.setItem('recentFiles', JSON.stringify(this.recentFiles));
    }
    
    loadSettings() {
        try {
            return JSON.parse(localStorage.getItem('appSettings') || '{}');
        } catch {
            return {};
        }
    }
    
    notifyStateChange(property, value) {
        window.dispatchEvent(new CustomEvent('appStateChange', {
            detail: { property, value }
        }));
    }
}
```

### 4. Tauri Command Integration
```javascript
// src/services/markdown-service.js
const { invoke } = window.__TAURI__.core;

class MarkdownService {
    async readFile(filePath) {
        return await invoke('read_markdown_file', { path: filePath });
    }
    
    async parseMarkdown(content) {
        return await invoke('parse_markdown', { content });
    }
    
    async startFileWatcher(filePath) {
        return await invoke('start_file_watch', { path: filePath });
    }
    
    async stopFileWatcher() {
        return await invoke('stop_file_watch');
    }
    
    async exportAsPdf() {
        return await invoke('export_as_pdf');
    }
    
    async exportAsHtml() {
        return await invoke('export_as_html');
    }
}
```

### 5. Event Handling and File Operations
```javascript
// src/main.js
class MarkdownViewer {
    constructor() {
        this.appState = new AppState();
        this.contentViewer = new ContentViewer(document.getElementById('content'));
        this.toc = new TableOfContents(document.getElementById('toc-sidebar'));
        this.markdownService = new MarkdownService();
        
        this.setupEventListeners();
        this.setupDragAndDrop();
        this.setupKeyboardShortcuts();
    }
    
    setupEventListeners() {
        window.addEventListener('appStateChange', (e) => {
            this.handleStateChange(e.detail.property, e.detail.value);
        });
        
        // Listen for file changes from Tauri
        window.__TAURI__.event.listen('file-changed', (event) => {
            this.reloadCurrentFile();
        });
    }
    
    setupDragAndDrop() {
        const dropZone = document.body;
        
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });
        
        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('drag-over');
        });
        
        dropZone.addEventListener('drop', async (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            
            const files = Array.from(e.dataTransfer.files);
            const markdownFile = files.find(f => f.name.endsWith('.md'));
            
            if (markdownFile) {
                await this.loadFile(markdownFile.path);
            }
        });
    }
    
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'f':
                        e.preventDefault();
                        this.openSearchDialog();
                        break;
                    case '=':
                    case '+':
                        e.preventDefault();
                        this.zoomIn();
                        break;
                    case '-':
                        e.preventDefault();
                        this.zoomOut();
                        break;
                    case 'r':
                        e.preventDefault();
                        this.reloadCurrentFile();
                        break;
                }
            }
        });
    }
    
    async loadFile(filePath) {
        try {
            await this.contentViewer.loadMarkdownFile(filePath);
            this.appState.setCurrentFile(filePath);
            await this.markdownService.startFileWatcher(filePath);
            this.generateTOC();
        } catch (error) {
            console.error('Failed to load file:', error);
        }
    }
    
    generateTOC() {
        const headers = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
            .map(header => ({
                id: header.id || this.generateId(header.textContent),
                text: header.textContent,
                level: parseInt(header.tagName.substring(1))
            }));
        
        this.toc.generateTOC(headers);
    }
    
    generateId(text) {
        return text.toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-');
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.markdownViewer = new MarkdownViewer();
});
```

## Module System
Since this is vanilla JS with ES6 modules, structure files as:

```
src/
├── main.js                 # Main application entry
├── components/
│   ├── content-viewer.js   # Markdown content display
│   ├── toc.js             # Table of contents
│   └── search-dialog.js    # Search functionality
├── services/
│   └── markdown-service.js # Tauri command interface
├── state/
│   └── app-state.js       # Application state management
└── utils/
    └── helpers.js         # Utility functions
```

## Import/Export Pattern
```javascript
// Export classes/functions
export class ContentViewer { ... }
export { MarkdownService };

// Import in main.js
import { ContentViewer } from './components/content-viewer.js';
import { MarkdownService } from './services/markdown-service.js';
```