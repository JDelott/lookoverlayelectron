import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

console.log('Renderer script loaded');

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
  }
  
  #root {
    width: 100%;
    height: 100%;
  }
`;

// Inject global styles
const styleElement = document.createElement('style');
styleElement.textContent = globalStyles;
document.head.appendChild(styleElement);

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing React');
  
  const container = document.getElementById('root');
  if (container) {
    console.log('Root container found');
    const root = createRoot(container);
    root.render(<App />);
  } else {
    console.error('Root container not found!');
  }
}); 
