export interface ProcessInfo {
  id: string;
  command: string;
  started: Date;
  isInteractive?: boolean;
}

export class ProcessHandler {
  private electronAPI: any;
  private runningProcesses = new Map<string, ProcessInfo>();
  private onProcessStarted?: (info: ProcessInfo) => void;
  private onProcessEnded?: (id: string) => void;

  constructor() {
    this.electronAPI = (window as any).electronAPI;
  }

  initialize(callbacks: {
    onProcessStarted?: (info: ProcessInfo) => void;
    onProcessEnded?: (id: string) => void;
  }): void {
    this.onProcessStarted = callbacks.onProcessStarted;
    this.onProcessEnded = callbacks.onProcessEnded;

    if (this.electronAPI) {
      this.electronAPI.onProcessStarted((info: ProcessInfo) => {
        this.runningProcesses.set(info.id, info);
        this.onProcessStarted?.(info);
      });

      this.electronAPI.onProcessEnded((info: { id: string }) => {
        this.runningProcesses.delete(info.id);
        this.onProcessEnded?.(info.id);
      });
    }
  }

  getRunningProcesses(): Map<string, ProcessInfo> {
    return new Map(this.runningProcesses);
  }

  hasRunningProcesses(): boolean {
    return this.runningProcesses.size > 0;
  }

  async killProcess(): Promise<void> {
    if (this.electronAPI) {
      try {
        await this.electronAPI.killProcess();
      } catch (error) {
        console.error('Failed to kill processes:', error);
        throw error;
      }
    }
  }
}
