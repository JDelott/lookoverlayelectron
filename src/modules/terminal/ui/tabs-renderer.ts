import { Terminal } from '../../types/index.js';
import { ProcessInfo } from '../streaming/index.js';

export interface ProblemsTabInfo {
  name: string;
  content: string;
  isActive: boolean;
}

export interface ProblemsCount {
  total: number;
  errors: number;
  warnings: number;
  info: number;
}

export class TabsRenderer {
  renderTabs(
    terminals: Terminal[], 
    activeTerminalId: string,
    activeTab: 'terminal' | 'problems',
    runningProcesses: Map<string, ProcessInfo>,
    problemsTabInfo: ProblemsTabInfo,
    problemsCount: ProblemsCount
  ): void {
    const tabsContainer = document.querySelector('.terminal-tabs');
    if (!tabsContainer) return;

    tabsContainer.innerHTML = '';
    
    // Render terminal tabs
    terminals.forEach((terminal) => {
      const tab = document.createElement('div');
      tab.className = `terminal-tab ${terminal.isActive && activeTab === 'terminal' ? 'active' : ''}`;
      
      const isRunning = runningProcesses.size > 0;
      const statusIcon = isRunning ? '🟢' : '⚫';
      
      // Show different close button behavior if this is the last terminal
      const isLastTerminal = terminals.length <= 1;
      const closeButtonContent = isLastTerminal ? '🗑️' : '×';
      const closeButtonTitle = isLastTerminal ? 'Clear terminal (cannot close last terminal)' : 'Close terminal';
      
      tab.innerHTML = `
        <span class="terminal-tab-icon">${statusIcon}</span>
        <span class="terminal-tab-name">${terminal.name}</span>
        <button class="terminal-tab-close" title="${closeButtonTitle}" ${isLastTerminal ? 'style="opacity: 0.6;"' : ''}>${closeButtonContent}</button>
      `;
      
      // Add click handler for the tab (excluding close button)
      tab.addEventListener('click', (e) => {
        if (!(e.target as HTMLElement).classList.contains('terminal-tab-close')) {
          // Trigger terminal switch
          const event = new CustomEvent('terminal-switch', { detail: { terminalId: terminal.id } });
          document.dispatchEvent(event);
        }
      });

      // Add separate click handler for the close button
      const closeButton = tab.querySelector('.terminal-tab-close') as HTMLButtonElement;
      if (closeButton) {
        closeButton.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          if (isLastTerminal) {
            console.log(`🗑️ Clearing last terminal: ${terminal.id}`);
          } else {
            console.log(`🗑️ Closing terminal: ${terminal.id}`);
          }
          
          // Dispatch close event (the close method will handle whether to clear or close)
          const closeEvent = new CustomEvent('terminal-close', { 
            detail: { terminalId: terminal.id } 
          });
          document.dispatchEvent(closeEvent);
        });
      }
      
      tabsContainer.appendChild(tab);
    });

    // Render problems tab
    const problemsTab = this.createProblemsTab(activeTab, problemsCount);
    problemsTab.onclick = () => {
      const event = new CustomEvent('terminal-switch-to-problems');
      document.dispatchEvent(event);
    };
    tabsContainer.appendChild(problemsTab);

    // Render new terminal button
    const newTabButton = document.createElement('button');
    newTabButton.className = 'terminal-new-tab';
    newTabButton.innerHTML = '+ New Terminal';
    newTabButton.onclick = () => {
      const event = new CustomEvent('terminal-create-new');
      document.dispatchEvent(event);
    };
    tabsContainer.appendChild(newTabButton);
  }

  private createProblemsTab(activeTab: 'terminal' | 'problems', problemsCount: ProblemsCount): HTMLElement {
    const problemsTab = document.createElement('div');
    problemsTab.className = `terminal-tab problems-tab ${activeTab === 'problems' ? 'active' : ''}`;
    
    let problemsIcon = '📋';
    if (problemsCount.errors > 0) {
      problemsIcon = '❌';
    } else if (problemsCount.warnings > 0) {
      problemsIcon = '⚠️';
    }
    
    let problemsLabel = 'Problems';
    if (problemsCount.total > 0) {
      const parts: string[] = [];
      if (problemsCount.errors > 0) parts.push(`${problemsCount.errors}`);
      if (problemsCount.warnings > 0) parts.push(`${problemsCount.warnings}`);
      if (parts.length > 0) {
        problemsLabel = `Problems ${parts.join('/')}`;
      }
    }
    
    problemsTab.innerHTML = `
      <span class="terminal-tab-icon">${problemsIcon}</span>
      <span class="terminal-tab-name">${problemsLabel}</span>
      <button class="problems-refresh-btn" onclick="event.stopPropagation(); window.problemsManager?.refreshProblems()" title="Refresh Problems">🔄</button>
    `;
    
    return problemsTab;
  }
}
