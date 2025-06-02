import React, { useEffect, useRef } from 'react';

const App: React.FC = () => {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // For now, let's just test if React is working
    console.log('React App loaded successfully');
    
    if (editorRef.current) {
      editorRef.current.innerHTML = '<h1>React is working! Monaco will load here.</h1>';
    }
  }, []);

  return (
    <div style={{ 
      width: '100vw', 
      height: '100vh', 
      margin: 0, 
      padding: 20,
      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
      backgroundColor: '#1e1e1e',
      color: 'white'
    }}>
      <h1>Lightweight IDE</h1>
      <div 
        ref={editorRef} 
        style={{ 
          width: '100%', 
          height: 'calc(100% - 60px)',
          border: '1px solid #333',
          marginTop: '20px'
        }} 
      />
    </div>
  );
};

export default App;
