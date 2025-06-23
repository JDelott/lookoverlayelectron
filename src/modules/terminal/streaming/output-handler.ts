import { AnsiProcessor } from '../utils/index.js';

export class OutputHandler {
  private currentInteractiveProcess: string | null = null;

  setInteractiveProcess(processId: string | null): void {
    this.currentInteractiveProcess = processId;
  }

  processOutput(data: string): string {
    if (this.currentInteractiveProcess) {
      return AnsiProcessor.cleanInteractiveOutput(data);
    }
    return data;
  }

  formatOutput(text: string): string {
    return AnsiProcessor.toHtml(text);
  }
}
