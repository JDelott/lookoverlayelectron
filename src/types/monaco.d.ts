declare global {
  interface Window {
    monaco: typeof import('monaco-editor');
    require: {
      config: (options: any) => void;
      (modules: string[], callback: () => void, errorback?: (error: any) => void): void;
    };
  }
}

export {};
