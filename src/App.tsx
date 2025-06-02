import React, { useEffect, useRef, useState } from 'react';
import FileExplorer from './components/FileExplorer';

const App: React.FC = () => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [sidebarWidth, setSidebarWidth] = useState(250);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    console.log('React App loaded successfully');
    
    if (editorRef.current) {
      editorRef.current.innerHTML = selectedFile 
        ? `<h2>File: ${selectedFile}</h2><p>Monaco editor will load here...</p>`
        : '<h2>No file selected</h2><p>Select a file from the explorer to edit</p>';
    }
  }, [selectedFile]);

  const handleFileSelect = (filePath: string) => {
    setSelectedFile(filePath);
    console.log('Selected file:', filePath);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing) return;
    const newWidth = Math.max(200, Math.min(600, e.clientX));
    setSidebarWidth(newWidth);
  };

  const handleMouseUp = () => {
    setIsResizing(false);
  };

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing]);

  return (
    <div className="app-container">
      {/* Title Bar */}
      <div className="title-bar">
        <span className="title-text">Lightweight IDE</span>
      </div>
      
      {/* Main Content */}
      <div className="main-content">
        {/* Sidebar */}
        <div 
          className="sidebar" 
          style={{ width: `${sidebarWidth}px` }}
        >
          <FileExplorer onFileSelect={handleFileSelect} />
        </div>
        
        {/* Resize Handle */}
        <div 
          className="resize-handle"
          onMouseDown={handleMouseDown}
        />
        
        {/* Editor Area */}
        <div className="editor-area">
          <div className="tab-bar">
            {selectedFile && (
              <div className="tab active">
                <span className="tab-icon">📄</span>
                <span className="tab-name">{selectedFile.split('/').pop()}</span>
                <span className="tab-close">×</span>
              </div>
            )}
          </div>
          <div 
            ref={editorRef} 
            className="editor-content"
          />
        </div>
      </div>
    </div>
  );
};

export default App;
