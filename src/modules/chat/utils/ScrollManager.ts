import { ScrollState } from '../core/ChatTypes.js';

export class ScrollManager {
  private scrollState: ScrollState;

  constructor() {
    this.scrollState = {
      isScrolling: false,
      scrollAnimationFrame: null,
      autoScrollEnabled: true,
      lastScrollPosition: 0,
      scrollUpdateScheduled: false
    };
    this.setupScrollMonitoring();
  }

  private setupScrollMonitoring(): void {
    const messagesContainer = document.getElementById('chat-messages') as HTMLElement;
    if (!messagesContainer) return;

    messagesContainer.addEventListener('scroll', () => {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 50;
      
      if (!this.scrollState.isScrolling) {
        this.scrollState.autoScrollEnabled = isAtBottom;
      }
    });
  }

  enableAutoScroll(): void {
    this.scrollState.autoScrollEnabled = true;
  }

  disableAutoScroll(): void {
    this.scrollState.autoScrollEnabled = false;
  }

  isAutoScrollEnabled(): boolean {
    return this.scrollState.autoScrollEnabled;
  }

  forceScrollToBottom(): void {
    const messagesContainer = document.getElementById('chat-messages') as HTMLElement;
    if (!messagesContainer) return;

    // Use multiple approaches to ensure scrolling works
    requestAnimationFrame(() => {
      // Set flag to indicate this is programmatic scrolling
      this.scrollState.isScrolling = true;

      // Method 1: Direct scroll to bottom
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      
      // Method 2: Ensure the last message is visible
      const lastMessage = messagesContainer.lastElementChild;
      if (lastMessage) {
        lastMessage.scrollIntoView({ block: 'end', behavior: 'auto' });
      }
      
      // Method 3: Double-check scroll position after a brief delay
      setTimeout(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        this.scrollState.isScrolling = false;
      }, 10);
    });
  }

  smoothScrollToBottom(): void {
    if (!this.scrollState.autoScrollEnabled) return;

    const messagesContainer = document.getElementById('chat-messages') as HTMLElement;
    if (!messagesContainer) return;

    // Cancel any existing scroll animation
    if (this.scrollState.scrollAnimationFrame) {
      cancelAnimationFrame(this.scrollState.scrollAnimationFrame);
    }

    // Set flag to indicate this is programmatic scrolling
    this.scrollState.isScrolling = true;

    // Use requestAnimationFrame for smooth scrolling
    this.scrollState.scrollAnimationFrame = requestAnimationFrame(() => {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      this.scrollState.scrollAnimationFrame = null;
      
      // Clear the programmatic scrolling flag
      setTimeout(() => {
        this.scrollState.isScrolling = false;
      }, 50);
    });
  }

  scheduleScrollUpdate(): void {
    if (this.scrollState.scrollUpdateScheduled) return;
    
    this.scrollState.scrollUpdateScheduled = true;
    
    // Use requestAnimationFrame to batch scroll updates
    requestAnimationFrame(() => {
      this.smoothScrollToBottomDuringStreaming();
      this.scrollState.scrollUpdateScheduled = false;
    });
  }

  private smoothScrollToBottomDuringStreaming(): void {
    const messagesContainer = document.getElementById('chat-messages') as HTMLElement;
    if (!messagesContainer) return;

    // Always scroll to bottom during progressive rendering for better UX
    const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
    
    // More aggressive auto-scroll during progressive rendering
    if (distanceFromBottom <= 200) {
      messagesContainer.scrollTo({
        top: messagesContainer.scrollHeight,
        behavior: 'auto'
      });
    }
  }
}
