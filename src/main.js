const { invoke } = window.__TAURI__.core;

let currentFilePath = null;

// DOM elements
let openFileBtn;
let fileInput;
let welcomeScreen;
let markdownViewer;
let markdownContent;

async function openFile() {
  try {
    // For now, let's test with a sample markdown file path
    // This will be replaced with file dialog functionality
    const sampleMarkdown = `# Welcome to Markdown Viewer

This is a **sample** markdown document to test our viewer.

## Features

- Parse markdown to HTML
- Clean, readable interface
- Support for *italic* and **bold** text
- Code blocks: \`inline code\`

### Lists

1. First item
2. Second item
3. Third item

> This is a blockquote to test styling.

\`\`\`javascript
console.log("Hello, world!");
\`\`\`

That's it for now!`;

    await loadMarkdownContent(sampleMarkdown);
  } catch (error) {
    console.error('Error opening file:', error);
    alert('Failed to open file: ' + error.message);
  }
}

async function loadMarkdownContent(markdownText) {
  try {
    // Show loading state
    markdownContent.innerHTML = '<div style="text-align: center; padding: 2rem;">Loading...</div>';
    welcomeScreen.style.display = 'none';
    markdownViewer.style.display = 'block';

    // Call Tauri command to parse markdown
    const htmlContent = await invoke('parse_markdown', { markdownContent: markdownText });
    
    // Display the parsed HTML
    markdownContent.innerHTML = htmlContent;
    
    // Update window title
    document.title = 'Markdown Viewer - Sample';
    
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
    // Show loading state
    markdownContent.innerHTML = '<div style="text-align: center; padding: 2rem;">Loading...</div>';
    welcomeScreen.style.display = 'none';
    markdownViewer.style.display = 'block';

    // Call Tauri command to read and parse markdown
    const htmlContent = await invoke('read_markdown_file', { filePath });
    
    // Display the parsed HTML
    markdownContent.innerHTML = htmlContent;
    currentFilePath = filePath;
    
    // Update window title
    document.title = `Markdown Viewer - ${filePath.split(/[\\/]/).pop()}`;
    
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

function setupDragAndDrop() {
  const app = document.querySelector('.app');
  
  app.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    app.style.backgroundColor = '#f8f9fa';
  });

  app.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    app.style.backgroundColor = '';
  });

  app.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    app.style.backgroundColor = '';

    const files = Array.from(e.dataTransfer.files);
    const markdownFile = files.find(file => 
      file.name.match(/\.(md|markdown|mdown|mkd)$/i)
    );

    if (markdownFile) {
      await loadMarkdownFile(markdownFile.path);
    } else {
      alert('Please drop a markdown file (.md, .markdown, .mdown, .mkd)');
    }
  });
}

window.addEventListener("DOMContentLoaded", () => {
  // Get DOM elements
  openFileBtn = document.querySelector('#open-file-btn');
  fileInput = document.querySelector('#file-input');
  welcomeScreen = document.querySelector('#welcome-screen');
  markdownViewer = document.querySelector('#markdown-viewer');
  markdownContent = document.querySelector('#markdown-content');

  // Setup event listeners
  openFileBtn.addEventListener('click', openFile);
  
  // Setup drag and drop
  setupDragAndDrop();
});
