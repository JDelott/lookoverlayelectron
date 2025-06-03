import React, { useEffect, useRef, useState } from 'react';
import FileExplorer from './components/FileExplorer';
import { ProjectSelector } from './components/ProjectSelector';
import '../styles/project-selector.css';

const App: React.FC = () => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [sidebarWidth, setSidebarWidth] = useState(250);
  const [isResizing, setIsResizing] = useState(false);
  const [currentProject, setCurrentProject] = useState<string>('');
  const [showProjectSelector, setShowProjectSelector] = useState(true);

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

  const handleProjectSelected = async (projectPath: string) => {
    try {
      const result = await (window as any).electronAPI.setCurrentDirectory(projectPath);
      if (result.success) {
        setCurrentProject(projectPath);
        setShowProjectSelector(false);
        console.log('Project selected:', projectPath);
      } else {
        console.error('Failed to set project directory:', result.error);
        alert('Failed to set project directory: ' + result.error);
      }
    } catch (error) {
      console.error('Error setting project:', error);
      alert('Error setting project: ' + error);
    }
  };

  return (
    <div className="app-container">
      {showProjectSelector && (
        <ProjectSelector
          onProjectSelected={handleProjectSelected}
          onClose={() => setShowProjectSelector(false)}
        />
      )}
      
      {/* Title Bar */}
      <div className="title-bar">
        <span className="title-text">Lightweight IDE</span>
        {currentProject && (
          <span className="current-project" style={{ marginLeft: '10px', color: '#569cd6' }}>
            📁 {currentProject.split('/').pop()}
          </span>
        )}
        <button 
          onClick={() => setShowProjectSelector(true)}
          className="project-switch-btn"
          title="Switch Project"
          style={{
            marginLeft: 'auto',
            background: 'transparent',
            border: '1px solid #3c3c3c',
            color: '#cccccc',
            padding: '4px 8px',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          📁
        </button>
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
