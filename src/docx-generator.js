// DOCX generation using the docx.js library
window.generateDocxFromMarkdown = async function(markdownText, title) {
  console.log('🔄 Generating DOCX using docx.js library...');
  
  try {
    // Convert markdown to HTML first
    const html = await window.__TAURI__.core.invoke('parse_markdown', { markdownContent: markdownText });
    
    // Parse the HTML to extract content
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Create paragraphs from the HTML content
    const paragraphs = [];
    
    // Add title
    paragraphs.push(
      new docx.Paragraph({
        text: title,
        heading: docx.HeadingLevel.TITLE,
        spacing: { after: 400 }
      })
    );
    
    // Process HTML elements
    const elements = doc.body.children;
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      
      if (element.tagName === 'P') {
        paragraphs.push(
          new docx.Paragraph({
            text: element.textContent,
            spacing: { after: 200 }
          })
        );
      } else if (element.tagName.match(/^H[1-6]$/)) {
        const level = parseInt(element.tagName.substring(1));
        paragraphs.push(
          new docx.Paragraph({
            text: element.textContent,
            heading: level <= 3 ? docx.HeadingLevel['HEADING_' + level] : docx.HeadingLevel.HEADING_3,
            spacing: { before: 300, after: 200 }
          })
        );
      } else if (element.tagName === 'UL' || element.tagName === 'OL') {
        const listItems = element.getElementsByTagName('li');
        for (let j = 0; j < listItems.length; j++) {
          paragraphs.push(
            new docx.Paragraph({
              text: listItems[j].textContent,
              bullet: element.tagName === 'UL' ? { level: 0 } : undefined,
              numbering: element.tagName === 'OL' ? { reference: "default-numbering", level: 0 } : undefined,
              spacing: { after: 100 }
            })
          );
        }
      } else if (element.tagName === 'BLOCKQUOTE') {
        paragraphs.push(
          new docx.Paragraph({
            text: element.textContent,
            style: "Quote",
            indent: { left: 720 },
            spacing: { after: 200 }
          })
        );
      } else if (element.tagName === 'PRE') {
        paragraphs.push(
          new docx.Paragraph({
            text: element.textContent,
            style: "Code",
            spacing: { after: 200 }
          })
        );
      }
    }
    
    // Create the document
    const document = new docx.Document({
      sections: [{
        properties: {},
        children: paragraphs
      }]
    });
    
    // Generate DOCX file as blob (browser-compatible)
    const blob = await docx.Packer.toBlob(document);
    console.log('✅ DOCX blob generated successfully, size:', blob.size);
    
    // Convert blob to Uint8Array for Tauri
    const arrayBuffer = await blob.arrayBuffer();
    return new Uint8Array(arrayBuffer);
    
  } catch (error) {
    console.error('❌ Failed to generate DOCX:', error);
    throw error;
  }
};

// Mark as ready
window.docxReady = true;
console.log('✅ DOCX generator loaded (docx.js)');