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

async function loadMarkdownContent(markdownText, fileName = 'Sample') {
  try {
    // Stop watching previous file since this is content-based
    if (currentFilePath) {
      await stopWatchingFile();
      currentFilePath = null;
    }
    
    // Show loading state
    markdownContent.innerHTML = '<div style="text-align: center; padding: 2rem;">Loading...</div>';
    welcomeScreen.style.display = 'none';
    markdownViewer.style.display = 'block';

    // Call Tauri command to parse markdown
    const htmlContent = await invoke('parse_markdown', { markdownContent: markdownText });
    
    // Display the parsed HTML
    markdownContent.innerHTML = htmlContent;
    
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

  // Setup event listeners
  openFileBtn.addEventListener('click', openFile);
  document.querySelector('#sample-btn').addEventListener('click', openSampleFile);
  
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
