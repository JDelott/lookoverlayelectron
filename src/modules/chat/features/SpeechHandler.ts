import { SpeechState, EventCallbacks } from '../core/ChatTypes.js';
import { ChatStateManager } from '../core/ChatStateManager.js';
import { ChatUIManager } from '../ui/ChatUIManager.js';
import { DOMHelpers } from '../utils/DOMHelpers.js';

export class SpeechHandler {
  private stateManager: ChatStateManager;
  private uiManager: ChatUIManager;
  private callbacks: EventCallbacks;
  private electronAPI: any;

  constructor(
    stateManager: ChatStateManager,
    uiManager: ChatUIManager,
    callbacks: EventCallbacks = {}
  ) {
    this.stateManager = stateManager;
    this.uiManager = uiManager;
    this.callbacks = callbacks;
    this.electronAPI = (window as any).electronAPI;
    this.setupSpeechListeners();
  }

  private setupSpeechListeners(): void {
    if (!this.electronAPI.onRecordingStateChanged) return;

    this.electronAPI.onRecordingStateChanged((data: { isRecording: boolean; error?: string }) => {
      const speechState = this.stateManager.getSpeechState();
      this.stateManager.setSpeechState({ isRecording: data.isRecording });
      
      this.uiManager.updateMicrophoneButton(data.isRecording);
      
      if (data.error) {
        this.showSpeechError(data.error);
      }

      this.callbacks.onRecordingStateChanged?.(data.isRecording);
    });
  }

  async toggleRecording(): Promise<void> {
    const speechState = this.stateManager.getSpeechState();
    
    if (speechState.isRecording) {
      await this.stopRecording();
    } else {
      await this.startRecording();
    }
  }

  private async startRecording(): Promise<void> {
    try {
      const recordingStartTime = Date.now();
      this.stateManager.setSpeechState({ recordingStartTime });
      
      const result = await this.electronAPI.startRecording();
      
      if (!result.success) {
        this.showSpeechError(result.error || 'Failed to start recording');
        return;
      }
      
      this.showRecordingFeedback();
    } catch (error) {
      console.error('Failed to start recording:', error);
      this.showSpeechError('Failed to start recording. Make sure microphone access is granted.');
    }
  }

  private async stopRecording(): Promise<void> {
    try {
      const result = await this.electronAPI.stopRecording();
      
      if (!result.success) {
        this.showSpeechError(result.error || 'Failed to stop recording');
        return;
      }
      
      this.hideRecordingFeedback();
      this.showTranscriptionFeedback();
      
      // Start transcription
      await this.transcribeRecording();
      
    } catch (error) {
      console.error('Failed to stop recording:', error);
      this.showSpeechError('Failed to stop recording');
    }
  }

  private async transcribeRecording(): Promise<void> {
    try {
      const result = await this.electronAPI.transcribeAudio();
      
      this.hideTranscriptionFeedback();
      
      if (!result.success) {
        this.showSpeechError(result.error || 'Transcription failed');
        return;
      }
      
      if (result.text) {
        // Insert transcribed text into the input
        const input = document.getElementById('chat-input') as HTMLTextAreaElement;
        if (input) {
          const currentValue = input.value;
          const newValue = currentValue ? `${currentValue} ${result.text}` : result.text;
          input.value = newValue;
          DOMHelpers.autoResizeTextarea(input);
          DOMHelpers.updateCharCount(input);
          input.focus();
          
          // Show success feedback
          this.showSpeechSuccess('Speech converted to text!');
        }
      }
      
    } catch (error) {
      console.error('Transcription failed:', error);
      this.hideTranscriptionFeedback();
      this.showSpeechError('Transcription failed');
    }
  }

  private showRecordingFeedback(): void {
    this.showSpeechFeedback('🎤 Recording... Click to stop', 'recording');
  }

  private hideRecordingFeedback(): void {
    this.hideSpeechFeedback();
  }

  private showTranscriptionFeedback(): void {
    this.showSpeechFeedback('🔄 Converting speech to text...', 'processing');
  }

  private hideTranscriptionFeedback(): void {
    this.hideSpeechFeedback();
  }

  private showSpeechFeedback(message: string, type: 'recording' | 'processing' = 'recording'): void {
    // Remove existing feedback
    this.hideSpeechFeedback();

    const feedback = document.createElement('div');
    feedback.className = 'speech-feedback';
    feedback.innerHTML = `
      <div class="speech-feedback-content ${type}">
        <span class="speech-message">${message}</span>
        ${type === 'recording' ? `<div class="recording-animation"></div>` : '<div class="processing-spinner"></div>'}
      </div>
    `;

    const inputArea = document.querySelector('.chat-input-area');
    if (inputArea) {
      inputArea.insertBefore(feedback, inputArea.firstChild);
    }
  }

  private hideSpeechFeedback(): void {
    const feedback = document.querySelector('.speech-feedback');
    if (feedback) {
      feedback.remove();
    }
  }

  private showSpeechError(message: string): void {
    DOMHelpers.showNotification(`❌ ${message}`, 'error');
  }

  private showSpeechSuccess(message: string): void {
    DOMHelpers.showNotification(`✅ ${message}`, 'success');
  }
}
