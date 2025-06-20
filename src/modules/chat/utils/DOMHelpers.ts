export class DOMHelpers {
  static escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  static removeEventListeners(elementIds: string[]): void {
    elementIds.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        // Clone and replace to remove all listeners
        const newElement = element.cloneNode(true);
        element.parentNode?.replaceChild(newElement, element);
      }
    });
  }

  static autoResizeTextarea(textarea: HTMLTextAreaElement): void {
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 150);
    textarea.style.height = newHeight + 'px';
  }

  static updateCharCount(textarea: HTMLTextAreaElement, maxLength: number = 50000): void {
    const charCount = document.getElementById('char-count');
    if (!charCount) return;

    const length = textarea.value.length;
    
    charCount.textContent = `${length.toLocaleString()} / ${maxLength.toLocaleString()}`;
    
    charCount.className = 'char-count';
    if (length > maxLength * 0.9) {
      charCount.classList.add('error');
    } else if (length > maxLength * 0.8) {
      charCount.classList.add('warning');
    }
  }

  static getFileIcon(extension: string): string {
    const iconMap: { [key: string]: string } = {
      'js': '🟨', 'ts': '🔵', 'jsx': '⚛️', 'tsx': '⚛️',
      'html': '🌐', 'css': '🎨', 'scss': '🎨', 'sass': '🎨',
      'json': '📋', 'xml': '📄', 'md': '📝', 'txt': '📄',
      'py': '🐍', 'java': '☕', 'cpp': '⚙️', 'c': '⚙️',
      'php': '🐘', 'rb': '💎', 'go': '🐹', 'rs': '🦀',
      'sql': '🗄️', 'sh': '💻', 'yml': '⚙️', 'yaml': '⚙️'
    };
    return iconMap[extension.toLowerCase()] || '📄';
  }

  static detectCodeContent(content: string): boolean {
    const codeIndicators = [
      /```[\s\S]*```/g,
      /^\s*(?:function|class|const|let|var|if|for|while|import|export)/m,
      /^\s*(?:def|class|import|from|if|for|while)/m,
      /^\s*(?:public|private|protected|static|void|int|string)/m,
      /{\s*[\s\S]*}/g,
      /^\s*\/\/|^\s*\/\*|^\s*\*/m,
      /^\s*#include|^\s*using namespace/m,
      /^\s*<\?php|^\s*\$[a-zA-Z]/m,
    ];

    const lines = content.split('\n');
    const codeLines = lines.filter(line => {
      return codeIndicators.some(pattern => pattern.test(line)) ||
             line.includes('{') || line.includes('}') ||
             line.includes(';') || line.includes('()') ||
             /^\s*[\w\d_]+\s*[=:]\s*/.test(line);
    });

    return codeLines.length > lines.length * 0.3;
  }

  static showNotification(message: string, type: 'success' | 'error'): void {
    const notification = document.createElement('div');
    notification.className = `speech-notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
}
