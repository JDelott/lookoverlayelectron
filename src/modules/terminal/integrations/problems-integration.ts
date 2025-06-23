import { ProblemsManager } from '../../problems/index.js';

export class ProblemsIntegration {
  private problemsManager: ProblemsManager;

  constructor(problemsManager: ProblemsManager) {
    this.problemsManager = problemsManager;
  }

  initialize(): void {
    this.setupProblemsListeners();
  }

  private setupProblemsListeners(): void {
    document.addEventListener('problems-updated', (event: any) => {
      const updateEvent = new CustomEvent('terminal-problems-updated', { detail: event.detail });
      document.dispatchEvent(updateEvent);
    });

    document.addEventListener('problems-count-changed', (event: any) => {
      const updateEvent = new CustomEvent('terminal-problems-count-changed', { detail: event.detail });
      document.dispatchEvent(updateEvent);
    });
  }

  getProblemsTab(): { name: string; content: string; isActive: boolean } {
    return this.problemsManager.getProblemsTab();
  }

  getProblemsCount(): { total: number; errors: number; warnings: number; info: number } {
    return this.problemsManager.getProblemsCount();
  }

  injectProblemsStyles(): void {
    const existingStyle = document.getElementById('problems-styles');
    if (existingStyle) return;

    const style = document.createElement('style');
    style.id = 'problems-styles';
    style.textContent = `
      .problems-panel {
        height: 100%;
        overflow-y: auto;
        background: #1e1e1e;
        color: #cccccc;
        font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Consolas', 'Courier New', monospace;
      }
    `;
    
    document.head.appendChild(style);
  }
}
