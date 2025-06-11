const { invoke } = window.__TAURI__.core;
const { open } = window.__TAURI__.dialog;

let currentFilePath = null;
let isInitialized = false;

// DOM elements
let openFileBtn;
let fileInput;
let welcomeScreen;
let markdownViewer;
let markdownContent;

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
    console.error('Error opening sample file:', error);
    alert('Failed to load sample content: ' + error.message);
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

function setupDragAndDrop() {
  const app = document.querySelector('.app');
  
  // Enhanced drag and drop with visual feedback
  app.addEventListener('dragenter', (e) => {
    e.preventDefault();
    e.stopPropagation();
    app.classList.add('drag-over');
  });
  
  app.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  });

  app.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Only remove if leaving the app entirely
    if (!app.contains(e.relatedTarget)) {
      app.classList.remove('drag-over');
    }
  });

  app.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    app.classList.remove('drag-over');

    const files = Array.from(e.dataTransfer.files);
    const markdownFile = files.find(file => 
      file.name.match(/\.(md|markdown|mdown|mkd)$/i)
    );

    if (markdownFile) {
      await loadMarkdownFile(markdownFile.path);
    } else if (files.length > 0) {
      alert('Please drop a markdown file (.md, .markdown, .mdown, .mkd)');
    }
  });
}

window.addEventListener("DOMContentLoaded", async () => {
  // Get DOM elements
  openFileBtn = document.querySelector('#open-file-btn');
  fileInput = document.querySelector('#file-input');
  welcomeScreen = document.querySelector('#welcome-screen');
  markdownViewer = document.querySelector('#markdown-viewer');
  markdownContent = document.querySelector('#markdown-content');

  // Setup event listeners
  openFileBtn.addEventListener('click', openFile);
  document.querySelector('#sample-btn').addEventListener('click', openSampleFile);
  
  // Setup drag and drop
  setupDragAndDrop();
  
  // Check for file associations (launch arguments)
  const foundFile = await checkLaunchArgs();
  
  // If no file was passed via launch args, show welcome screen
  if (!foundFile) {
    isInitialized = true;
  }
});
