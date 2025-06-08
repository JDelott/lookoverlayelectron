export {};

declare global {
  interface Window {
    electronAPI: {
      // File system operations
      getDirectoryContents: (path?: string) => Promise<any[]>;
      readFile: (filePath: string) => Promise<string>;
      writeFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
      getCurrentDirectory: () => Promise<string>;
      
      // Command execution
      executeCommand: (command: string, workingDir?: string) => Promise<any>;
      killProcess: (processId?: string) => Promise<{ success: boolean; message?: string; error?: string }>;
      
      // Terminal operations
      createTerminal: () => Promise<{ success: boolean; error?: string }>;
      writeTerminal: (data: string) => Promise<{ success: boolean; error?: string }>;
      killTerminal: () => Promise<{ success: boolean }>;
      
      // Event listeners
      onTerminalOutput: (callback: (data: string) => void) => void;
      onTerminalClosed: (callback: (code: number) => void) => void;
      onCommandOutputStream: (callback: (data: string) => void) => void;
      onProcessStarted: (callback: (info: { id: string; command: string }) => void) => void;
      onProcessEnded: (callback: (info: { id: string }) => void) => void;
      
      // AI API
      callAnthropicAPI: (messages: any[], systemPrompt?: string) => Promise<any>;
      
      // Project management
      setCurrentDirectory: (directoryPath: string) => Promise<{ success: boolean; currentDirectory?: string; error?: string }>;
      selectProjectDirectory: () => Promise<string | null>;
      getRecentProjects: () => Promise<any[]>;
      saveRecentProject: (projectPath: string) => Promise<{ success: boolean; error?: string }>;
      
      // External operations
      openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;
      getSources: () => Promise<any[]>;
      getScreenInfo: () => Promise<any>;
    };

    monaco: typeof import('monaco-editor');
    require: {
      config: (options: any) => void;
      (modules: string[], callback: () => void, errorback?: (error: any) => void): void;
    };

    // Global app instances
    app?: any;
    layoutManager?: any;
    chatManager?: any;
  }
}
