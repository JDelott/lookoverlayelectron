console.log('Renderer loaded');

// Global styles
const globalStyles = `
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  
  html, body {
    width: 100%;
    height: 100%;
    overflow: hidden;
    background-color: #1e1e1e;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    color: white;
  }
  
  #root {
    width: 100%;
    height: 100%;
  }
  
  #editor-container {
    width: 100%;
    height: 100%;
    border: 2px solid red; /* Debug border */
  }
`;

// Inject global styles
const styleElement = document.createElement('style');
styleElement.textContent = globalStyles;
document.head.appendChild(styleElement);

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing Monaco Editor');
  
  const container = document.getElementById('root');
  if (container) {
    console.log('Container dimensions:', container.offsetWidth, 'x', container.offsetHeight);
    
    container.innerHTML = '<div id="editor-container">Loading editor...</div>';
    
    const editorContainer = document.getElementById('editor-container');
    console.log('Editor container dimensions:', editorContainer?.offsetWidth, 'x', editorContainer?.offsetHeight);
    
    // Add a delay to ensure the container is ready
    setTimeout(() => {
      console.log('Starting Monaco initialization...');
      
      // Configure Monaco Editor using the global require from the CDN
      (window as any).require.config({ 
        paths: { vs: 'https://unpkg.com/monaco-editor@0.44.0/min/vs' } 
      });
      
      (window as any).require(['vs/editor/editor.main'], () => {
        console.log('Monaco modules loaded');
        
        const editorContainer = document.getElementById('editor-container');
        if (editorContainer) {
          console.log('Creating editor in container with dimensions:', editorContainer.offsetWidth, 'x', editorContainer.offsetHeight);
          
          try {
            const editor = (window as any).monaco.editor.create(editorContainer, {
              value: `// Welcome to your lightweight IDE!
console.log("Hello World!");

function test() {
  return "Monaco Editor is working!";
}`,
              language: 'javascript',
              theme: 'vs-dark',
              automaticLayout: true,
              fontSize: 16,
              minimap: {
                enabled: false  // Disable minimap for now
              },
              scrollBeyondLastLine: false,
              wordWrap: 'on'
            });
            
            console.log('Monaco Editor created successfully:', editor);
            
            // Force layout
            setTimeout(() => {
              editor.layout();
              console.log('Editor layout forced');
            }, 100);
            
          } catch (error) {
            console.error('Error creating Monaco Editor:', error);
          }
        } else {
          console.error('Editor container not found during Monaco creation!');
        }
      });
    }, 500);
  } else {
    console.error('Root container not found!');
  }
});
