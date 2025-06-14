// Initialize highlight.js for syntax highlighting
document.addEventListener('DOMContentLoaded', function() {
  if (typeof hljs !== 'undefined') {
    // Configure highlight.js
    hljs.configure({
      languages: ['javascript', 'typescript', 'python', 'rust', 'html', 'css', 'sql', 'json', 'bash', 'shell', 'yaml', 'xml', 'markdown', 'c', 'cpp', 'java', 'go', 'php', 'ruby', 'swift', 'kotlin']
    });
    
    // Mark as ready
    window.highlightJsReady = true;
    console.log('✅ Highlight.js initialized successfully');
    
    // Function to highlight all code blocks
    window.highlightCodeBlocks = function() {
      if (typeof hljs !== 'undefined') {
        // Find all code blocks that haven't been highlighted yet
        const codeBlocks = document.querySelectorAll('pre code:not(.hljs)');
        codeBlocks.forEach(block => {
          try {
            hljs.highlightElement(block);
          } catch (error) {
            console.warn('Error highlighting code block:', error);
          }
        });
      }
    };
    
    // Function to switch highlight.js theme based on color scheme
    window.updateHighlightTheme = function() {
      const lightTheme = document.getElementById('highlight-theme-light');
      const darkTheme = document.getElementById('highlight-theme-dark');
      const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      
      if (isDarkMode) {
        lightTheme.disabled = true;
        darkTheme.disabled = false;
      } else {
        lightTheme.disabled = false;
        darkTheme.disabled = true;
      }
    };
    
    // Initial theme setup
    window.updateHighlightTheme();
    
    // Listen for color scheme changes
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', window.updateHighlightTheme);
    }
  } else {
    console.warn('⚠️ Highlight.js not available');
  }
});