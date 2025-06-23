export interface InteractiveProcess {
  id: string;
  command: string;
  started: Date;
}

export class InteractiveModeManager {
  private electronAPI: any;
  private runningProcesses = new Map<string, InteractiveProcess>();
  private currentInteractiveProcess: string | null = null;
  private lastInteractivePrompt: string = '';

  constructor() {
    this.electronAPI = (window as any).electronAPI;
  }

  startInteractiveProcess(id: string, command: string): void {
    const process: InteractiveProcess = {
      id,
      command,
      started: new Date()
    };
    
    this.runningProcesses.set(id, process);
    this.currentInteractiveProcess = id;
  }

  endInteractiveProcess(id: string): void {
    this.runningProcesses.delete(id);
    
    if (this.currentInteractiveProcess === id) {
      this.currentInteractiveProcess = null;
      this.lastInteractivePrompt = '';
    }
  }

  async sendInput(input: string): Promise<boolean> {
    if (!this.currentInteractiveProcess || !this.electronAPI) {
      return false;
    }

    console.log(`Sending interactive input: "${input}" to process ${this.currentInteractiveProcess}`);
    this.lastInteractivePrompt = '';

    try {
      const result = await this.electronAPI.sendProcessInput(this.currentInteractiveProcess, input);
      return result.success;
    } catch (error) {
      console.error('Error sending input to process:', error);
      return false;
    }
  }

  isInInteractiveMode(): boolean {
    return this.currentInteractiveProcess !== null;
  }

  getCurrentProcess(): InteractiveProcess | null {
    if (!this.currentInteractiveProcess) return null;
    return this.runningProcesses.get(this.currentInteractiveProcess) || null;
  }

  getAllRunningProcesses(): InteractiveProcess[] {
    return Array.from(this.runningProcesses.values());
  }
}
