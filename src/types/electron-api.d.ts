export {};

declare global {
  interface Window {
    electronAPI: {
      captureScreenshot: () => Promise<string>;
      callAnthropicAPI: (imageData: string, prompt: string) => Promise<any>;
    }
  }
}
