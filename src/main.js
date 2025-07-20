const { invoke } = window.__TAURI__.core;
const { open, save } = window.__TAURI__.dialog;
const { writeFile, BaseDirectory } = window.__TAURI__.fs;

// No processor needed - use html-docx-js directly


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
let originalContentHTML = '';

// Security: HTML sanitization function
function sanitizeHTML(html) {
  if (typeof DOMPurify !== 'undefined') {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'b', 'i', 'u', 's', 'del', 'ins',
        'ul', 'ol', 'li', 'dl', 'dt', 'dd',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'blockquote', 'pre', 'code', 'kbd', 'samp', 'var',
        'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
        'a', 'img', 'figure', 'figcaption',
        'div', 'span', 'hr', 'sup', 'sub',
        'details', 'summary',
        // Mermaid diagram containers (but not script tags)
        'svg', 'g', 'path', 'text', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon'
      ],
      ALLOWED_ATTR: [
        'href', 'title', 'alt', 'src', 'width', 'height',
        'class', 'id', 'style', 'target', 'rel',
        'data-search-result',
        // SVG attributes for Mermaid
        'viewBox', 'xmlns', 'x', 'y', 'cx', 'cy', 'r', 'rx', 'ry',
        'fill', 'stroke', 'stroke-width', 'd', 'transform',
        'text-anchor', 'font-family', 'font-size', 'font-weight'
      ],
      ALLOW_DATA_ATTR: false,
      ALLOW_UNKNOWN_PROTOCOLS: false,
      ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|file|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
      // Keep safe URL protocols only
      FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select', 'iframe'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit']
    });
  } else {
    console.warn('DOMPurify not available, using safe fallback');
    // Safe fallback - escape all HTML to prevent any XSS
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  }
}

// Security: Input validation for search queries
function validateSearchInput(input) {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  // Limit search input length to prevent DoS
  if (input.length > 1000) {
    console.warn('Search input too long, truncating');
    input = input.substring(0, 1000);
  }
  
  // Remove potential script injection attempts
  const dangerous_patterns = [
    '<script', '</script', 'javascript:', 'data:', 'vbscript:', 'onload=', 'onerror='
  ];
  
  for (const pattern of dangerous_patterns) {
    if (input.toLowerCase().includes(pattern)) {
      console.warn('Dangerous pattern detected in search input:', pattern);
      return ''; // Return empty string for safety
    }
  }
  
  return input;
}

// Recent files management
function getRecentFiles() {
  try {
    const recentFiles = localStorage.getItem('markdownViewer_recentFiles');
    return recentFiles ? JSON.parse(recentFiles) : [];
  } catch (error) {
    console.warn('Error reading recent files from localStorage:', error);
    return [];
  }
}

function addToRecentFiles(filePath, fileName) {
  try {
    let recentFiles = getRecentFiles();
    
    // Remove if already exists to avoid duplicates
    recentFiles = recentFiles.filter(file => file.path !== filePath);
    
    // Add to beginning of list
    recentFiles.unshift({
      path: filePath,
      name: fileName || filePath.split(/[\\\/]/).pop(),
      timestamp: Date.now()
    });
    
    // Limit to MAX_RECENT_FILES
    if (recentFiles.length > MAX_RECENT_FILES) {
      recentFiles = recentFiles.slice(0, MAX_RECENT_FILES);
    }
    
    localStorage.setItem('markdownViewer_recentFiles', JSON.stringify(recentFiles));
    updateRecentFilesUI();
  } catch (error) {
    console.warn('Error saving recent files to localStorage:', error);
  }
}

function removeFromRecentFiles(filePath) {
  try {
    let recentFiles = getRecentFiles();
    recentFiles = recentFiles.filter(file => file.path !== filePath);
    localStorage.setItem('markdownViewer_recentFiles', JSON.stringify(recentFiles));
    updateRecentFilesUI();
  } catch (error) {
    console.warn('Error removing file from recent files:', error);
  }
}

function validateRecentFiles() {
  // Note: In a Tauri app, we can't directly check if files exist from the frontend
  // This validation would need to be done via a Tauri command
  // For now, we'll implement basic cleanup and add file validation later
  try {
    let recentFiles = getRecentFiles();
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    // Remove files older than one week
    recentFiles = recentFiles.filter(file => file.timestamp > oneWeekAgo);
    
    localStorage.setItem('markdownViewer_recentFiles', JSON.stringify(recentFiles));
    updateRecentFilesUI();
  } catch (error) {
    console.warn('Error validating recent files:', error);
  }
}

// Recent files variables
let recentFilesDropdown = null;
let isRecentFilesVisible = false;
const MAX_RECENT_FILES = 10;

// Zoom functionality variables
let currentZoomLevel = 100;
const MIN_ZOOM = 50;
const MAX_ZOOM = 200;
const ZOOM_STEP = 10;
let zoomLevelsByFile = new Map(); // Store zoom levels per file

// DOM elements
let openFileBtn;
let fileInput;
let welcomeScreen;
let markdownViewer;
let markdownContent;
let exportHtmlBtn;
let exportDocxBtn;
let printPdfBtn;
let exportButtonGroup;
let exportDropdownBtn;
let exportDropdownMenu;
let isExportDropdownVisible = false;

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
  const rawInput = event.target.value;
  const validatedInput = validateSearchInput(rawInput);
  const newSearchTerm = validatedInput.trim();
  
  // Update the input field if validation changed the content
  if (event.target.value !== validatedInput) {
    event.target.value = validatedInput;
  }
  
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
  
  // Store original HTML if not already stored
  if (!originalContentHTML) {
    originalContentHTML = markdownContent.innerHTML;
  }
  
  // Use DOM-based approach that preserves Mermaid diagrams
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
        
        // Skip Mermaid diagram containers to preserve rendered SVGs
        if (parent && (parent.classList.contains('mermaid-diagram-container') || 
                       parent.closest('.mermaid-diagram-container'))) {
          return NodeFilter.FILTER_REJECT;
        }
        
        // Skip SVG elements (Mermaid renders as SVG)
        if (parent && (parent.tagName === 'SVG' || parent.closest('svg'))) {
          return NodeFilter.FILTER_REJECT;
        }
        
        // Skip search highlight spans to avoid duplicate results
        if (parent && (parent.classList.contains('search-highlight') || parent.classList.contains('search-highlight-current'))) {
          return NodeFilter.FILTER_REJECT;
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
  
  // Search through text nodes and create highlights
  const regex = new RegExp(escapeRegex(term), 'gi');
  
  textNodes.forEach(textNode => {
    const text = textNode.textContent;
    const matches = [...text.matchAll(regex)];
    
    if (matches.length > 0) {
      // Create document fragment to hold the new content
      const fragment = document.createDocumentFragment();
      let lastIndex = 0;
      
      matches.forEach(match => {
        const matchStart = match.index;
        const matchEnd = matchStart + match[0].length;
        
        // Add text before match
        if (matchStart > lastIndex) {
          const beforeText = text.slice(lastIndex, matchStart);
          fragment.appendChild(document.createTextNode(beforeText));
        }
        
        // Create highlighted span for match
        const highlightSpan = document.createElement('span');
        highlightSpan.className = 'search-highlight';
        highlightSpan.textContent = match[0];
        highlightSpan.setAttribute('data-search-result', searchResults.length);
        fragment.appendChild(highlightSpan);
        
        // Add to results array
        searchResults.push(highlightSpan);
        
        lastIndex = matchEnd;
      });
      
      // Add remaining text after last match
      if (lastIndex < text.length) {
        const afterText = text.slice(lastIndex);
        fragment.appendChild(document.createTextNode(afterText));
      }
      
      // Replace the original text node with the fragment
      textNode.parentNode.replaceChild(fragment, textNode);
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
  // Remove individual highlight spans without destroying Mermaid diagrams
  searchResults.forEach(span => {
    if (span && span.parentNode) {
      // Replace the highlight span with its text content
      const textNode = document.createTextNode(span.textContent);
      span.parentNode.replaceChild(textNode, span);
    }
  });
  
  // Normalize text nodes to merge adjacent text nodes
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

// Export dropdown functions
function toggleExportDropdown() {
  if (isExportDropdownVisible) {
    hideExportDropdown();
  } else {
    showExportDropdown();
  }
}

function showExportDropdown() {
  isExportDropdownVisible = true;
  exportDropdownMenu.classList.add('show');
}

function hideExportDropdown() {
  isExportDropdownVisible = false;
  exportDropdownMenu.classList.remove('show');
}

// Recent files UI functions
function createRecentFilesDropdown() {
  if (recentFilesDropdown) return;
  
  recentFilesDropdown = document.createElement('div');
  recentFilesDropdown.className = 'recent-files-dropdown';
  recentFilesDropdown.innerHTML = `
    <div class="recent-files-header">
      <span class="recent-files-title">Recent Files</span>
      <button class="recent-files-close" title="Close">×</button>
    </div>
    <div class="recent-files-list"></div>
    <div class="recent-files-footer">
      <button class="recent-files-clear" title="Clear All">Clear All</button>
    </div>
  `;
  
  document.body.appendChild(recentFilesDropdown);
  
  // Event listeners
  const closeBtn = recentFilesDropdown.querySelector('.recent-files-close');
  const clearBtn = recentFilesDropdown.querySelector('.recent-files-clear');
  
  closeBtn.addEventListener('click', hideRecentFiles);
  clearBtn.addEventListener('click', clearRecentFiles);
  
  // Click outside to close
  document.addEventListener('click', (event) => {
    if (isRecentFilesVisible && 
        !recentFilesDropdown.contains(event.target) && 
        !event.target.closest('#recent-files-btn') &&
        !event.target.closest('.split-button')) {
      hideRecentFiles();
    }
  });
}

function showRecentFiles() {
  createRecentFilesDropdown();
  updateRecentFilesUI();
  
  if (getRecentFiles().length === 0) {
    return; // Don't show if no recent files
  }
  
  isRecentFilesVisible = true;
  recentFilesDropdown.style.display = 'block';
  
  // Position near the recent files dropdown button
  const recentBtn = document.querySelector('#recent-files-btn');
  if (recentBtn) {
    const rect = recentBtn.getBoundingClientRect();
    recentFilesDropdown.style.top = (rect.bottom + 5) + 'px';
    
    // Set initial position first, then adjust based on width
    recentFilesDropdown.style.left = rect.right + 'px';
    
    // After a short delay, adjust positioning based on actual width
    setTimeout(() => {
      const dropdownWidth = recentFilesDropdown.offsetWidth;
      recentFilesDropdown.style.left = (rect.right - dropdownWidth) + 'px';
    }, 0);
  }
}

function hideRecentFiles() {
  if (!recentFilesDropdown) return;
  
  isRecentFilesVisible = false;
  recentFilesDropdown.style.display = 'none';
}

function updateRecentFilesUI() {
  if (!recentFilesDropdown) return;
  
  const listContainer = recentFilesDropdown.querySelector('.recent-files-list');
  const recentFiles = getRecentFiles();
  
  if (recentFiles.length === 0) {
    listContainer.innerHTML = '<div class="recent-files-empty">No recent files</div>';
    return;
  }
  
  // Clear previous content
  listContainer.innerHTML = '';
  
  // Create recent file items safely
  recentFiles.forEach(file => {
    // Sanitize file data
    const sanitizedPath = DOMPurify ? DOMPurify.sanitize(file.path) : file.path;
    const sanitizedName = DOMPurify ? DOMPurify.sanitize(file.name) : file.name;
    
    const itemDiv = document.createElement('div');
    itemDiv.className = 'recent-file-item';
    itemDiv.dataset.path = encodeURIComponent(sanitizedPath);
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'recent-file-content';
    
    const nameDiv = document.createElement('div');
    nameDiv.className = 'recent-file-name';
    nameDiv.title = sanitizedPath;
    nameDiv.textContent = sanitizedName;
    
    const pathDiv = document.createElement('div');
    pathDiv.className = 'recent-file-path';
    pathDiv.textContent = sanitizedPath;
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'recent-file-remove';
    removeBtn.title = 'Remove from list';
    removeBtn.textContent = '×';
    
    contentDiv.appendChild(nameDiv);
    contentDiv.appendChild(pathDiv);
    itemDiv.appendChild(contentDiv);
    itemDiv.appendChild(removeBtn);
    listContainer.appendChild(itemDiv);
  });
  
  // Add click handlers
  listContainer.querySelectorAll('.recent-file-item').forEach(item => {
    const filePath = decodeURIComponent(item.dataset.path);
    
    item.addEventListener('click', (event) => {
      if (event.target.classList.contains('recent-file-remove')) {
        event.stopPropagation();
        removeFromRecentFiles(filePath);
      } else {
        hideRecentFiles();
        loadMarkdownFile(filePath).catch(error => {
          console.error('Failed to load recent file:', error);
          alert('Failed to open file. It may have been moved or deleted.');
          removeFromRecentFiles(filePath);
        });
      }
    });
  });
}

function clearRecentFiles() {
  try {
    localStorage.removeItem('markdownViewer_recentFiles');
    updateRecentFilesUI();
    hideRecentFiles();
  } catch (error) {
    console.warn('Error clearing recent files:', error);
  }
}

// Zoom functionality
function updateZoomLevel(newZoomLevel) {
  // Clamp zoom level to valid range
  currentZoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoomLevel));
  
  // Apply zoom to the markdown content
  const contentElement = document.querySelector('#markdown-content');
  if (contentElement) {
    const scale = currentZoomLevel / 100;
    contentElement.style.transform = `scale(${scale})`;
    contentElement.style.transformOrigin = 'top left';
    
    // Adjust the content container to account for scaling
    // When scaling up, we need more space; when scaling down, we need less
    contentElement.style.width = `${100 / scale}%`;
    contentElement.style.height = scale > 1 ? 'auto' : 'auto';
    
    // Ensure the viewer container can scroll properly
    const viewerElement = document.querySelector('#markdown-viewer');
    if (viewerElement) {
      viewerElement.style.overflow = 'auto';
    }
  }
  
  // Update zoom level display
  const zoomLevelElement = document.querySelector('#zoom-level');
  if (zoomLevelElement) {
    zoomLevelElement.textContent = `${currentZoomLevel}%`;
  }
  
  // Update button states
  updateZoomButtonStates();
  
  // Store zoom level for current file
  if (currentFilePath) {
    zoomLevelsByFile.set(currentFilePath, currentZoomLevel);
  }
}

function updateZoomButtonStates() {
  const zoomInBtn = document.querySelector('#zoom-in-btn');
  const zoomOutBtn = document.querySelector('#zoom-out-btn');
  
  if (zoomInBtn) {
    zoomInBtn.disabled = currentZoomLevel >= MAX_ZOOM;
  }
  
  if (zoomOutBtn) {
    zoomOutBtn.disabled = currentZoomLevel <= MIN_ZOOM;
  }
}

function zoomIn() {
  updateZoomLevel(currentZoomLevel + ZOOM_STEP);
}

function zoomOut() {
  updateZoomLevel(currentZoomLevel - ZOOM_STEP);
}

function resetZoom() {
  updateZoomLevel(100);
}

function restoreZoomForFile(filePath) {
  if (filePath && zoomLevelsByFile.has(filePath)) {
    const savedZoom = zoomLevelsByFile.get(filePath);
    updateZoomLevel(savedZoom);
  } else {
    updateZoomLevel(100); // Default zoom
  }
}

function showZoomControls() {
  const zoomControls = document.querySelector('#zoom-controls');
  if (zoomControls) {
    zoomControls.style.display = 'flex';
  }
}

function hideZoomControls() {
  const zoomControls = document.querySelector('#zoom-controls');
  if (zoomControls) {
    zoomControls.style.display = 'none';
  }
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
- ✅ **Footnotes** - Reference-style footnotes
- ✅ **Task Lists** - Interactive checkboxes
- ✅ **Image Rendering** - Local and remote images with enhanced styling
- ✅ **Mermaid Diagrams** - Flowcharts, sequence diagrams, gantt charts
- ✅ **Recent Files List** - Quick access to recently opened markdown files
- ✅ **Zoom Controls** - Zoom in/out with mouse or keyboard shortcuts (Ctrl +/-)
- ✅ **Find in Page** - Search text with Ctrl+F, highlighting and navigation
- ✅ **HTML Export** - Export current document as standalone HTML
- ✅ **DOCX Export** - Export as Word document with full formatting
- ✅ **Print to PDF** - Print documents to PDF with optimized layout
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
- [x] ✅ Mermaid diagram support with consistent styling
- [x] ✅ Recent files list functionality
- [x] ✅ Zoom controls with keyboard shortcuts
- [x] 🔍 Find in page (Ctrl+F)
- [x] ✅ DOCX export functionality
- [x] ✅ Print to PDF support
- [x] ✅ Modern UI design system
- [x] ✅ Optimized window sizing
- [ ] 📋 Table of contents sidebar
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

## 💻 Syntax Highlighting

Our syntax highlighting supports 20+ programming languages with color-coded themes that automatically adapt to light/dark mode:

### Quick Examples
\`\`\`javascript
// JavaScript with colorized keywords, strings, and comments
const viewer = new MarkdownViewer('#content');
viewer.loadFile('sample.md'); // String in green, comments in gray
\`\`\`

\`\`\`python
# Python with highlighted syntax
def process_markdown(file_path: str) -> str:
    """Process markdown with syntax highlighting."""
    return highlight_syntax(content)  # Function calls in blue
\`\`\`

\`\`\`rust
// Rust backend code with proper highlighting
#[tauri::command]
async fn parse_markdown(content: &str) -> Result<String, String> {
    Ok(process_content(content))  // Keywords in purple
}
\`\`\`

**Supported Languages**: JavaScript, TypeScript, Python, Rust, HTML, CSS, SQL, JSON, Bash, YAML, C/C++, Java, Go, PHP, Ruby, Swift, Kotlin, and more!

## 📝 Footnotes and References

This markdown viewer supports footnotes and multiple reference styles for citations and additional information.

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

The **Export dropdown** (visible when viewing content) provides multiple export options:

### HTML Export
- Generate standalone HTML files with embedded CSS
- Preserve all formatting, syntax highlighting, and styling
- Include images and tables in the exported document
- Create files that work offline without external dependencies

### DOCX Export
- Export as Microsoft Word document (.docx)
- Maintain document structure with headings, lists, and formatting
- Preserve text styling (bold, italic, code blocks)
- Compatible with Microsoft Word and other office suites

### Print to PDF
- Print documents directly to PDF format
- Optimized layout with proper page breaks
- Clean formatting without UI elements
- Perfect for sharing and archiving

Simply click the "Export" dropdown in the toolbar and choose your preferred format!

## 🚀 How to Use All Features

### File Operations
1. **Open files**: Drag & drop .md files into the window
2. **File associations**: Double-click .md files in your file manager
3. **Recent files**: Click the dropdown arrow next to "Open File" for quick access
4. **Auto-reload**: Edit files in your editor and see changes instantly
5. **Export**: Use the Export dropdown for HTML, DOCX, or PDF formats

### Zoom and View Controls
- **Zoom in**: Press \`Ctrl++\` or click the + button
- **Zoom out**: Press \`Ctrl+-\` or click the - button  
- **Reset zoom**: Press \`Ctrl+0\` or click the home button
- **Zoom range**: 50% to 200% with 10% increments
- **Per-file memory**: Zoom level is remembered for each opened file

### Find in Page
- **Open search**: Press \`Ctrl+F\` to open the search dialog
- **Search navigation**: 
  - \`Enter\` - Navigate to next result
  - \`Shift+Enter\` - Navigate to previous result
  - Use ↑/↓ buttons in search dialog for navigation
- **Close search**: Press \`Escape\` or click × button
- **Features**: Real-time search with highlighting, result counter, smooth scrolling to matches

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
    Mermaid Diagrams   :done, mermaid, after footnotes, 4d
    HTML Export        :done, export, after mermaid, 3d
    Find in Page       :done, search, after export, 5d
    Recent Files List  :done, recent, after search, 3d
    section Export & UI
    DOCX Export        :done, docx, after recent, 4d
    Print to PDF       :done, pdf, after docx, 3d
    Zoom Controls      :done, zoom, after pdf, 3d
    Modern UI Design   :done, ui, after zoom, 4d
    Window Optimization :done, window, after ui, 2d
\`\`\`

---

*This markdown viewer is built with Tauri (Rust) + Vanilla JavaScript, featuring real-time file watching, comprehensive markdown support, beautiful syntax highlighting, and interactive Mermaid diagrams.*`;

    // Store sample markdown for DOCX export
    window.sampleMarkdownContent = sampleMarkdown;
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
    
    // Display the parsed HTML with sanitization
    const sanitizedHTML = sanitizeHTML(htmlContent);
    markdownContent.innerHTML = sanitizedHTML;
    
    // Add image error handling
    setupImageErrorHandling();
    
    // Process Mermaid diagrams
    await processMermaidDiagrams();
    
    // Apply syntax highlighting to code blocks
    await applySyntaxHighlighting();
    
    // Store original HTML for search functionality AFTER all processing
    originalContentHTML = markdownContent.innerHTML;
    
    // Show export button group
    exportButtonGroup.style.display = 'inline-flex';
    
    // Show zoom controls
    showZoomControls();
    
    // Reset zoom for sample content
    resetZoom();
    
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
    
    // Display the parsed HTML with sanitization
    const sanitizedHTML = sanitizeHTML(htmlContent);
    markdownContent.innerHTML = sanitizedHTML;
    currentFilePath = filePath;
    
    // Add image error handling
    setupImageErrorHandling();
    
    // Process Mermaid diagrams
    await processMermaidDiagrams();
    
    // Apply syntax highlighting to code blocks
    await applySyntaxHighlighting();
    
    // Store original HTML for search functionality AFTER all processing
    originalContentHTML = markdownContent.innerHTML;
    
    // Show export button group
    exportButtonGroup.style.display = 'inline-flex';
    
    // Show zoom controls
    showZoomControls();
    
    // Restore zoom level for this file
    restoreZoomForFile(filePath);
    
    // Update window title
    document.title = `Markdown Viewer - ${currentTitle}`;
    
    // Add to recent files
    addToRecentFiles(filePath, currentTitle);
    
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
    // First check if there's a file opened via "Open With" (macOS RunEvent::Opened)
    const openedFile = await invoke('get_opened_file');
    if (openedFile) {
      await loadMarkdownFile(openedFile);
      return true;
    }
    
    // Fallback: check command line arguments (for other platforms or direct execution)
    const args = await invoke('get_launch_args');
    
    // Look for markdown file in arguments (skip first arg which is the executable)
    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      if (arg.match(/\.(md|markdown|mdown|mkd)$/i)) {
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
        useMaxWidth: true,
        fontSize: 12,
        sectionFontSize: 13,
        barHeight: 24,
        barGap: 6,
        leftPadding: 100,
        rightPadding: 100,
        topPadding: 50,
        titleTopMargin: 25
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
        // Create error content safely without innerHTML
        const titleDiv = document.createElement('div');
        titleDiv.style.fontWeight = 'bold';
        titleDiv.textContent = '📊 Mermaid Diagram Error';
        
        const messageDiv = document.createElement('div');
        messageDiv.style.fontSize = '0.875rem';
        messageDiv.style.marginTop = '0.5rem';
        messageDiv.textContent = 'Failed to render diagram';
        
        const errorMessageDiv = document.createElement('div');
        errorMessageDiv.style.fontSize = '0.75rem';
        errorMessageDiv.style.marginTop = '0.25rem';
        errorMessageDiv.style.color = '#6c757d';
        errorMessageDiv.textContent = error.message || 'Unknown error';
        
        const details = document.createElement('details');
        details.style.marginTop = '0.5rem';
        
        const summary = document.createElement('summary');
        summary.style.cursor = 'pointer';
        summary.textContent = 'Show diagram source';
        
        const pre = document.createElement('pre');
        pre.style.background = '#fff';
        pre.style.padding = '0.5rem';
        pre.style.marginTop = '0.5rem';
        pre.style.borderRadius = '0.25rem';
        pre.style.overflowX = 'auto';
        
        const code = document.createElement('code');
        code.textContent = diagramText;
        
        pre.appendChild(code);
        details.appendChild(summary);
        details.appendChild(pre);
        
        errorDiv.appendChild(titleDiv);
        errorDiv.appendChild(messageDiv);
        errorDiv.appendChild(errorMessageDiv);
        errorDiv.appendChild(details);
        
        const preElement = block.closest('pre') || block;
        preElement.parentNode.replaceChild(errorDiv, preElement);
      }
    }
    
  } catch (error) {
    console.error('❌ Error processing Mermaid diagrams:', error);
  }
}

async function applySyntaxHighlighting() {
  if (!window.highlightJsReady || typeof hljs === 'undefined') {
    console.log('⚠️ Highlight.js not ready, skipping syntax highlighting');
    return;
  }
  
  try {
    console.log('🎨 Applying syntax highlighting...');
    
    // Find all code blocks that haven't been highlighted yet
    const codeBlocks = markdownContent.querySelectorAll('pre code:not(.hljs)');
    console.log(`Found ${codeBlocks.length} code block(s) to highlight`);
    
    let highlightedCount = 0;
    codeBlocks.forEach(block => {
      try {
        // Skip if this is inside a Mermaid diagram container
        if (block.closest('.mermaid-diagram-container')) {
          return;
        }
        
        // Apply syntax highlighting
        hljs.highlightElement(block);
        highlightedCount++;
        
        console.log(`✅ Highlighted code block: ${block.className || 'auto-detected'}`);
      } catch (error) {
        console.warn('⚠️ Error highlighting code block:', error, block);
      }
    });
    
    console.log(`✅ Applied syntax highlighting to ${highlightedCount} code block(s)`);
    
  } catch (error) {
    console.error('❌ Error applying syntax highlighting:', error);
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
      // Create error content safely without innerHTML
      const titleDiv = document.createElement('div');
      titleDiv.textContent = '📷 Image failed to load';
      
      const altDiv = document.createElement('div');
      altDiv.style.fontSize = '0.875rem';
      altDiv.style.marginTop = '0.5rem';
      altDiv.textContent = img.alt || 'No description';
      
      const srcDiv = document.createElement('div');
      srcDiv.style.fontSize = '0.75rem';
      srcDiv.style.marginTop = '0.25rem';
      srcDiv.style.color = '#6c757d';
      srcDiv.textContent = img.src;
      
      fallback.appendChild(titleDiv);
      fallback.appendChild(altDiv);
      fallback.appendChild(srcDiv);
      
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
      console.log('Generating enhanced HTML document...');
      
      // Get the current rendered content
      const contentElement = document.querySelector('#markdown-content');
      const renderedContent = contentElement ? contentElement.innerHTML : currentMarkdownContent;
      
      // Create self-contained HTML document with embedded CSS and resources
      const htmlDocument = generateSelfContainedHtml(renderedContent, currentTitle);
      
      console.log('Enhanced HTML document generated, length:', htmlDocument.length);
      
      // Write the HTML file using Tauri v2 API
      console.log('Writing file...');
      await writeFile(filePath, new TextEncoder().encode(htmlDocument));
      
      console.log('File written successfully');
      alert(`Enhanced HTML exported successfully to: ${filePath}`);
    } else {
      console.log('No file path selected');
    }
  } catch (error) {
    console.error('Error exporting HTML:', error);
    console.error('Error details:', error.message, error.stack);
    alert('Failed to export HTML: ' + error.message);
  }
}

function generateSelfContainedHtml(content, title) {
  // Get the current CSS styles
  const cssStyles = Array.from(document.styleSheets)
    .map(sheet => {
      try {
        return Array.from(sheet.cssRules)
          .map(rule => rule.cssText)
          .join('\n');
      } catch (e) {
        // Handle CORS issues with external stylesheets
        return '';
      }
    })
    .join('\n');

  // Additional CSS for better standalone display
  const additionalCSS = `
    /* Enhanced standalone styles */
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #fff;
      margin: 0;
      padding: 2rem;
      max-width: 900px;
      margin: 0 auto;
    }
    
    /* Print styles */
    @media print {
      body { margin: 1rem; padding: 0; }
      .content { box-shadow: none; }
    }
    
    /* Ensure images are responsive */
    img { max-width: 100%; height: auto; }
    
    /* Table improvements */
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 1rem 0;
    }
    
    th, td {
      border: 1px solid #ddd;
      padding: 0.5rem;
      text-align: left;
    }
    
    th {
      background-color: #f5f5f5;
      font-weight: bold;
    }
    
    /* Code improvements */
    pre, code {
      background-color: #f5f5f5;
      border-radius: 3px;
    }
    
    pre {
      padding: 1rem;
      overflow-x: auto;
    }
    
    code {
      padding: 0.2rem 0.4rem;
      font-family: 'Monaco', 'Consolas', 'Courier New', monospace;
    }
    
    /* Mermaid diagram styling */
    .mermaid-diagram-container {
      background: #fafafa;
      border: 1px solid #e1e4e8;
      border-radius: 6px;
      padding: 1rem;
      margin: 1rem 0;
      text-align: center;
    }
    
    .mermaid-diagram-container svg {
      max-width: 100%;
      height: auto;
    }
  `;

  // Create the complete HTML document
  const htmlDocument = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    <style>
${cssStyles}
${additionalCSS}
    </style>
    <!-- Mermaid for diagrams -->
    <script src="https://unpkg.com/mermaid@10.6.1/dist/mermaid.min.js"></script>
    <script>
        // Initialize Mermaid when page loads
        document.addEventListener('DOMContentLoaded', function() {
            if (typeof mermaid !== 'undefined') {
                mermaid.initialize({
                    startOnLoad: true,
                    theme: 'default',
                    securityLevel: 'loose'
                });
            }
        });
    </script>
</head>
<body>
    <div class="content">
        ${content}
    </div>
    
    <!-- Footer with generation info -->
    <footer style="margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #eee; font-size: 0.875rem; color: #666; text-align: center;">
        <p>Generated from ${escapeHtml(title)} on ${new Date().toLocaleString()}</p>
        <p>Created with <a href="https://github.com/vanzan01/markdown-viewer" style="color: #007bff; text-decoration: none;">Markdown Viewer</a></p>
    </footer>
</body>
</html>`;

  return htmlDocument;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Additional secure HTML escaping for content injection
function secureEscapeHtml(text) {
  if (typeof text !== 'string') {
    return '';
  }
  
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/`/g, '&#x60;')
    .replace(/=/g, '&#x3D;');
}

async function printToPdf() {
  try {
    if (!currentMarkdownContent) {
      alert('No content to print. Please load a markdown file first.');
      return;
    }

    console.log('Print to PDF function called');
    
    // Check if we're on macOS where window.print() doesn't work properly
    const isMac = navigator.platform.toUpperCase().includes('MAC') || 
                  navigator.userAgent.toUpperCase().includes('MAC');
    
    if (isMac) {
      // For macOS, export HTML and open in browser where print works properly
      try {
        const content = document.querySelector('.content');
        if (!content) {
          alert('No content found to export');
          return;
        }
        
        // Get the content safely
        const contentHtml = content.innerHTML;
        
        // Validate content size before processing
        if (contentHtml.length > 10 * 1024 * 1024) { // 10MB limit
          alert('Content too large to export safely');
          return;
        }
        
        // Create full HTML document with embedded styles and secure content injection
        const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${secureEscapeHtml('Markdown Document')}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      background: white;
    }
    
    h1, h2, h3, h4, h5, h6 {
      margin-top: 1.5rem;
      margin-bottom: 0.75rem;
      font-weight: 600;
      line-height: 1.2;
    }
    
    h1 { font-size: 2rem; }
    h2 { font-size: 1.5rem; }
    h3 { font-size: 1.25rem; }
    
    p { margin-bottom: 1rem; }
    
    ul, ol { margin-bottom: 1rem; padding-left: 2rem; }
    li { margin-bottom: 0.25rem; }
    
    code {
      background: #f5f5f5;
      padding: 0.2rem 0.4rem;
      border-radius: 3px;
      font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 0.9em;
    }
    
    pre {
      background: #f5f5f5;
      padding: 1rem;
      border-radius: 5px;
      overflow-x: auto;
      margin-bottom: 1rem;
    }
    
    pre code { background: none; padding: 0; }
    
    table {
      border-collapse: collapse;
      width: 100%;
      margin-bottom: 1rem;
    }
    
    th, td {
      border: 1px solid #ddd;
      padding: 0.5rem;
      text-align: left;
    }
    
    th { background: #f5f5f5; font-weight: 600; }
    
    img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 1rem auto;
    }
    
    blockquote {
      border-left: 4px solid #ddd;
      padding-left: 1rem;
      margin: 1rem 0;
      color: #666;
    }
    
    a { color: #0066cc; text-decoration: underline; }
    
    hr {
      border: none;
      border-top: 1px solid #ddd;
      margin: 2rem 0;
    }
    
    @media print {
      body { padding: 0; max-width: none; }
      h1, h2, h3, h4, h5, h6 { page-break-after: avoid; }
      pre, blockquote, table, img { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  ${contentHtml}
</body>
</html>`;
        
        await invoke('save_temp_html_and_open', { htmlContent: fullHtml });
        alert('Document opened in browser. Use File → Print to save as PDF.');
        return;
        
      } catch (error) {
        console.error('Failed to open in browser:', error);
        alert('Failed to open in browser. Using fallback print dialog.');
        // Fall through to window.print() fallback
      }
    }
    
    // Reset zoom to 100% for printing to ensure consistent layout
    const originalZoom = currentZoomLevel;
    if (currentZoomLevel !== 100) {
      updateZoomLevel(100);
    }
    
    // Add print-specific styles for better PDF output
    const printStyles = document.createElement('style');
    printStyles.id = 'print-styles';
    printStyles.textContent = `
      @media print {
        /* Hide UI elements */
        .header { display: none !important; }
        .controls { display: none !important; }
        .zoom-controls { display: none !important; }
        
        /* Optimize content for print */
        .app { height: auto !important; }
        .main { display: block !important; overflow: visible !important; }
        .viewer { overflow: visible !important; display: block !important; }
        .content { 
          max-width: none !important; 
          margin: 0 !important; 
          padding: 1rem !important;
          transform: none !important;
          width: 100% !important;
        }
        
        /* Improve text rendering */
        body { 
          font-size: 12pt !important; 
          line-height: 1.4 !important;
          color: black !important;
          background: white !important;
        }
        
        /* Table improvements */
        table { 
          border-collapse: collapse !important;
          page-break-inside: avoid;
        }
        
        /* Code block improvements */
        pre, code {
          background: #f5f5f5 !important;
          border: 1px solid #ddd !important;
          page-break-inside: avoid;
        }
        
        /* Image handling */
        img {
          max-width: 100% !important;
          page-break-inside: avoid;
        }
        
        /* Heading improvements */
        h1, h2, h3, h4, h5, h6 {
          page-break-after: avoid;
          color: black !important;
        }
        
        /* Mermaid diagrams */
        .mermaid-diagram-container {
          background: white !important;
          border: 1px solid #ddd !important;
          page-break-inside: avoid;
        }
      }
    `;
    
    document.head.appendChild(printStyles);
    
    // Trigger print dialog
    window.print();
    
    // Clean up: remove print styles and restore zoom
    setTimeout(() => {
      const printStylesElement = document.getElementById('print-styles');
      if (printStylesElement) {
        printStylesElement.remove();
      }
      
      // Restore original zoom level
      if (originalZoom !== 100) {
        updateZoomLevel(originalZoom);
      }
    }, 1000);
    
  } catch (error) {
    console.error('Error printing to PDF:', error);
    alert('Failed to print: ' + error.message);
  }
}

async function exportDocx() {
  try {
    console.log('🔄 Starting DOCX export using Pandoc WebAssembly...');
    
    // Input validation
    if (!currentMarkdownContent) {
      throw new Error('No content to export');
    }

    // Check if DOCX generator is ready
    if (!window.docxReady || !window.generateDocxFromMarkdown) {
      throw new Error('DOCX generator not loaded');
    }

    console.log('📄 Getting original markdown content...');
    
    // Get the original markdown content (stored when file was loaded)
    // We need the raw markdown, not the rendered HTML
    const markdownText = await getOriginalMarkdownContent();
    
    if (!markdownText) {
      throw new Error('Could not retrieve original markdown content');
    }

    console.log('🔄 Converting markdown to DOCX using docx.js...');
    
    // Generate filename without extension
    const titleWithoutExt = currentTitle.replace(/\.(md|markdown|mdown|mkd)$/i, '');
    
    // Use the docx.js library to generate DOCX
    const uint8Array = await window.generateDocxFromMarkdown(markdownText, titleWithoutExt);

    console.log('📊 Final DOCX size:', uint8Array.length, 'bytes');

    if (uint8Array.length === 0) {
      throw new Error('Generated DOCX is empty');
    }

    // Generate filename
    const defaultName = currentTitle.replace(/\.(md|markdown|mdown|mkd)$/i, '') + '.docx';
    console.log('📁 Default filename:', defaultName);
    
    // Show save dialog
    const filePath = await save({
      title: 'Export as DOCX',
      defaultPath: defaultName,
      filters: [
        {
          name: 'Word Document',
          extensions: ['docx']
        }
      ]
    });

    if (!filePath) {
      console.log('❌ No file path selected');
      return;
    }

    console.log('📁 Selected file path:', filePath);
    
    // Save file using Tauri v2 API
    console.log('🔄 Writing DOCX file...');
    await writeFile(filePath, uint8Array);
    
    console.log('✅ DOCX exported successfully to:', filePath);
    alert(`DOCX exported successfully to: ${filePath}`);
    
  } catch (error) {
    console.error('❌ Error exporting DOCX:', error);
    console.error('Error details:', error.message);
    
    if (error.message && error.message.includes('not loaded')) {
      alert('Pandoc WebAssembly library not loaded. Please refresh the page and try again.');
    } else if (error.message && error.message.includes('No content')) {
      alert('No content to export. Please load a markdown file first.');
    } else {
      alert('Failed to export DOCX: ' + (error.message || 'Unknown error'));
    }
  }
}

// Helper function to get original markdown content
async function getOriginalMarkdownContent() {
  // If we have a current file path, re-read the file to get original markdown
  if (currentFilePath) {
    try {
      const content = await invoke('read_file_content', { filePath: currentFilePath });
      return content;
    } catch (error) {
      console.warn('Could not re-read file content:', error);
    }
  }
  
  // For sample content, use the current markdown content
  if (currentTitle === 'Sample' && currentMarkdownContent) {
    return currentMarkdownContent;
  }
  
  throw new Error('Could not retrieve original markdown content');
}

window.addEventListener("DOMContentLoaded", async () => {
  
  // Get DOM elements
  openFileBtn = document.querySelector('#open-file-btn');
  fileInput = document.querySelector('#file-input');
  welcomeScreen = document.querySelector('#welcome-screen');
  markdownViewer = document.querySelector('#markdown-viewer');
  markdownContent = document.querySelector('#markdown-content');
  exportHtmlBtn = document.querySelector('#export-html-btn');
  exportDocxBtn = document.querySelector('#export-docx-btn');
  printPdfBtn = document.querySelector('#print-pdf-btn');
  exportButtonGroup = document.querySelector('#export-button-group');
  exportDropdownBtn = document.querySelector('#export-dropdown-btn');
  exportDropdownMenu = document.querySelector('#export-dropdown-menu');

  // Setup event listeners
  openFileBtn.addEventListener('click', openFile);
  document.querySelector('#recent-files-btn').addEventListener('click', showRecentFiles);
  document.querySelector('#sample-btn').addEventListener('click', openSampleFile);
  
  // Welcome screen button event listeners (secure alternative to inline onclick)
  document.querySelector('#welcome-open-btn').addEventListener('click', openFile);
  document.querySelector('#welcome-sample-btn').addEventListener('click', openSampleFile);
  exportHtmlBtn.addEventListener('click', () => {
    hideExportDropdown();
    exportHtml();
  });
  exportDocxBtn.addEventListener('click', () => {
    hideExportDropdown();
    exportDocx();
  });
  printPdfBtn.addEventListener('click', () => {
    hideExportDropdown();
    printToPdf();
  });
  
  // Export dropdown functionality
  exportDropdownBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleExportDropdown();
  });
  document.querySelector('#export-main-btn').addEventListener('click', () => {
    // Default export action - export as HTML
    exportHtml();
  });
  
  // Click outside to close export dropdown
  document.addEventListener('click', (event) => {
    if (isExportDropdownVisible && 
        !exportButtonGroup.contains(event.target)) {
      hideExportDropdown();
    }
  });
  
  // Zoom control event listeners
  document.querySelector('#zoom-in-btn').addEventListener('click', zoomIn);
  document.querySelector('#zoom-out-btn').addEventListener('click', zoomOut);
  document.querySelector('#zoom-reset-btn').addEventListener('click', resetZoom);
  
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
    // Zoom keyboard shortcuts
    else if (event.ctrlKey && (event.key === '=' || event.key === '+')) {
      event.preventDefault();
      zoomIn();
    }
    else if (event.ctrlKey && event.key === '-') {
      event.preventDefault();
      zoomOut();
    }
    else if (event.ctrlKey && event.key === '0') {
      event.preventDefault();
      resetZoom();
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
  
  // Listen for file opened via OS "Open With" events
  await listen('file-opened-via-os', async (event) => {
    const filePath = event.payload;
    if (filePath) {
      // Small delay to ensure UI is ready
      setTimeout(async () => {
        await loadMarkdownFile(filePath);
      }, 100);
    }
  });
  
  // Check for file associations (launch arguments)
  const foundFile = await checkLaunchArgs();
  
  // Initialize recent files
  validateRecentFiles();
  
  // If no file was passed via launch args, show welcome screen
  if (!foundFile) {
    isInitialized = true;
  }
});
