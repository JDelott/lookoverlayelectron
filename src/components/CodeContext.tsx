import React from 'react';

interface CodeContextProps {
  currentFile?: string;
  selectedText?: string;
}

export const CodeContext: React.FC<CodeContextProps> = ({
  currentFile,
  selectedText
}) => {
  if (!currentFile && !selectedText) {
    return null;
  }

  return (
    <div className="code-context">
      <div className="context-header">
        <span className="context-title">📁 Current Context</span>
      </div>
      
      <div className="context-content">
        {currentFile && (
          <div className="context-item">
            <span className="context-label">File:</span>
            <span className="context-value">{currentFile.split('/').pop()}</span>
          </div>
        )}
        
        {selectedText && (
          <div className="context-item">
            <span className="context-label">Selected:</span>
            <div className="selected-text-preview">
              {selectedText.length > 100 
                ? `${selectedText.substring(0, 100)}...` 
                : selectedText
              }
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
