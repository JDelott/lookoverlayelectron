console.log('🚀 RENDERER SCRIPT STARTING - THIS SHOULD SHOW UP FIRST');

// Types
interface AppState {
  currentFile: string;
  currentWorkingDirectory: string;
  showProjectSelector: boolean;
  openTabs: Map<string, any>;
  activeTabPath: string;
  terminals: Map<string, any>;
  activeTerminalId: string;
  terminalCounter: number;
  terminalVisible: boolean;
  terminalHeight: number;
  aiChatVisible: boolean;
  monacoEditor: any;
}

class SimpleRenderer {
  private state: AppState;

  constructor() {
    console.log('🔧 Creating SimpleRenderer...');
    this.state = {
      currentFile: '',
      currentWorkingDirectory: '/Users/jacobdelott/Downloads/lookoverlayelectron-main',
      showProjectSelector: true,
      openTabs: new Map(),
      activeTabPath: '',
      terminals: new Map(),
      activeTerminalId: '',
      terminalCounter: 1,
      terminalVisible: false,
      terminalHeight: 200,
      aiChatVisible: false,
      monacoEditor: null
    };
  }

  async initialize(): Promise<void> {
    console.log('🔧 Initializing SimpleRenderer...');
    
    if (this.state.showProjectSelector) {
      this.createProjectSelector();
    } else {
      this.createMainLayout();
    }
    
    console.log('🎉 SimpleRenderer initialized successfully');
  }

  private createProjectSelector(): void {
    console.log('🔧 Creating project selector...');
    const root = document.getElementById('root');
    if (!root) {
      console.error('❌ Root element not found');
      return;
    }

    root.innerHTML = `
      <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(0, 0, 0, 0.8); display: flex; justify-content: center; align-items: center; z-index: 10000;">
        <div style="background-color: #252526; border-radius: 8px; width: 600px; max-width: 90vw; max-height: 80vh; overflow: hidden; border: 1px solid #3c3c3c;">
          <div style="background-color: #2d2d30; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #3c3c3c;">
            <h2 style="margin: 0; color: #cccccc; font-size: 18px; font-weight: 600;">Select Project</h2>
            <button onclick="window.simpleRenderer?.hideProjectSelector()" style="background: transparent; border: none; color: #cccccc; font-size: 18px; cursor: pointer; padding: 4px;">✕</button>
          </div>
          
          <div style="padding: 20px;">
            <div style="display: flex; gap: 12px; margin-bottom: 24px;">
              <button onclick="window.simpleRenderer?.useCurrentDirectory()" style="flex: 1; padding: 12px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; background-color: #0e639c; color: white;">
                📂 Use Current Directory
              </button>
            </div>
            <div style="text-align: center; color: #888; padding: 20px;">
              <p style="margin: 0;">Click "Use Current Directory" to start with the current folder.</p>
            </div>
          </div>
        </div>
      </div>
    `;
    
    console.log('✅ Project selector created');
  }

  private createMainLayout(): void {
    console.log('🔧 Creating main layout...');
    const root = document.getElementById('root');
    if (!root) return;

    root.innerHTML = `
      <div style="width: 100%; height: 100vh; background: #1e1e1e; color: #cccccc; display: flex; flex-direction: column;">
        <div style="height: 40px; background: #2d2d30; border-bottom: 1px solid #3c3c3c; display: flex; align-items: center; padding: 0 16px;">
          <span>Lightweight IDE - ${this.state.currentWorkingDirectory}</span>
        </div>
        <div style="flex: 1; display: flex;">
          <div style="width: 250px; background: #252526; border-right: 1px solid #3c3c3c;">
            <div style="padding: 10px;">File Explorer</div>
          </div>
          <div style="flex: 1; background: #1e1e1e;">
            <div style="padding: 20px;">
              <h2>Welcome to Lightweight IDE!</h2>
              <p>Main interface is working.</p>
            </div>
          </div>
        </div>
      </div>
    `;
    
    console.log('✅ Main layout created');
  }

  async useCurrentDirectory(): Promise<void> {
    console.log('🔧 Using current directory...');
    this.state.showProjectSelector = false;
    this.createMainLayout();
  }

  hideProjectSelector(): void {
    console.log('🔧 Hiding project selector...');
    this.state.showProjectSelector = false;
    this.createMainLayout();
  }
}

// Make it globally available
(window as any).simpleRenderer = new SimpleRenderer();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  console.log('📄 Document loading, waiting for DOMContentLoaded...');
  document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM ready, initializing...');
    (window as any).simpleRenderer.initialize();
  });
} else {
  console.log('📄 DOM already ready, initializing immediately...');
  (window as any).simpleRenderer.initialize();
}
