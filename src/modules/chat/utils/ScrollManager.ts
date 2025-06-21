import { ScrollState } from '../core/ChatTypes.js';

export class ScrollManager {
  private scrollState: ScrollState;
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    this.scrollState = {
      isScrolling: false,
      scrollAnimationFrame: null,
      autoScrollEnabled: true,
      lastScrollPosition: 0,
      scrollUpdateScheduled: false
    };
    this.setupScrollMonitoring();
    this.setupResizeObserver();
  }

  private setupScrollMonitoring(): void {
    const messagesContainer = document.getElementById('chat-messages') as HTMLElement;
    if (!messagesContainer) {
      // Retry after a short delay if container not ready
      setTimeout(() => this.setupScrollMonitoring(), 100);
      return;
    }

    // Enhanced scroll listener with throttling
    let scrollTimeout: NodeJS.Timeout | null = null;
    
    messagesContainer.addEventListener('scroll', () => {
      // Clear existing timeout
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
      
      // Throttle scroll handling
      scrollTimeout = setTimeout(() => {
        this.handleScroll(messagesContainer);
      }, 10);
    }, { passive: true });
  }

  private handleScroll(container: HTMLElement): void {
    const { scrollTop, scrollHeight, clientHeight } = container;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 100; // Increased threshold
    
    // Only update auto-scroll if user initiated the scroll
    if (!this.scrollState.isScrolling) {
      this.scrollState.autoScrollEnabled = isAtBottom;
      this.scrollState.lastScrollPosition = scrollTop;
    }
  }

  private setupResizeObserver(): void {
    const messagesContainer = document.getElementById('chat-messages') as HTMLElement;
    if (!messagesContainer || !window.ResizeObserver) return;

    // Monitor container size changes to maintain scroll position
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (this.scrollState.autoScrollEnabled) {
          // Debounce resize-triggered scrolls
          this.scheduleScrollUpdate();
        }
      }
    });

    this.resizeObserver.observe(messagesContainer);
  }

  enableAutoScroll(): void {
    this.scrollState.autoScrollEnabled = true;
    console.log('🔄 Auto-scroll enabled');
  }

  disableAutoScroll(): void {
    this.scrollState.autoScrollEnabled = false;
    console.log('⏸️ Auto-scroll disabled');
  }

  isAutoScrollEnabled(): boolean {
    return this.scrollState.autoScrollEnabled;
  }

  forceScrollToBottom(): void {
    const messagesContainer = document.getElementById('chat-messages') as HTMLElement;
    if (!messagesContainer) return;

    // Cancel any pending scroll updates
    if (this.scrollState.scrollAnimationFrame) {
      cancelAnimationFrame(this.scrollState.scrollAnimationFrame);
      this.scrollState.scrollAnimationFrame = null;
    }

    // Use requestAnimationFrame for smooth scrolling
    this.scrollState.scrollAnimationFrame = requestAnimationFrame(() => {
      this.scrollState.isScrolling = true;

      // Multiple scroll methods for better compatibility
      const targetScroll = messagesContainer.scrollHeight;
      
      // Method 1: Direct scroll assignment
      messagesContainer.scrollTop = targetScroll;
      
      // Method 2: Smooth scroll for modern browsers
      try {
        messagesContainer.scrollTo({
          top: targetScroll,
          behavior: 'auto' // Use 'auto' for immediate scroll during streaming
        });
      } catch (e) {
        // Fallback for older browsers
        messagesContainer.scrollTop = targetScroll;
      }
      
      // Clear the programmatic scrolling flag after animation
      setTimeout(() => {
        this.scrollState.isScrolling = false;
        this.scrollState.scrollAnimationFrame = null;
      }, 50);
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

    this.scrollState.scrollAnimationFrame = requestAnimationFrame(() => {
      this.scrollState.isScrolling = true;
      
      // Use smooth scrolling for user-initiated scrolls
      messagesContainer.scrollTo({
        top: messagesContainer.scrollHeight,
        behavior: 'smooth'
      });
      
      // Clear the programmatic scrolling flag
      setTimeout(() => {
        this.scrollState.isScrolling = false;
        this.scrollState.scrollAnimationFrame = null;
      }, 300); // Longer timeout for smooth scroll
    });
  }

  scheduleScrollUpdate(): void {
    if (!this.scrollState.autoScrollEnabled) return;
    if (this.scrollState.scrollUpdateScheduled) return;
    
    this.scrollState.scrollUpdateScheduled = true;
    
    // Use requestAnimationFrame for smooth 60fps updates
    requestAnimationFrame(() => {
      this.performScheduledScroll();
      this.scrollState.scrollUpdateScheduled = false;
    });
  }

  private performScheduledScroll(): void {
    const messagesContainer = document.getElementById('chat-messages') as HTMLElement;
    if (!messagesContainer) return;

    const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
    
    // More intelligent scroll behavior during streaming
    if (this.scrollState.autoScrollEnabled) {
      if (distanceFromBottom <= 150) {
        // Close to bottom - immediate scroll
        messagesContainer.scrollTop = scrollHeight;
      } else if (distanceFromBottom <= 300) {
        // Moderate distance - smooth catch up
        const targetScroll = scrollHeight - clientHeight;
        const currentScroll = scrollTop;
        const diff = targetScroll - currentScroll;
        
        // Gradual scroll to catch up
        messagesContainer.scrollTop = currentScroll + (diff * 0.3);
      }
      // If too far from bottom, let user manually scroll back
    }
  }

  // Enhanced method for streaming content
  maintainScrollPositionDuringStreaming(): void {
    if (!this.scrollState.autoScrollEnabled) return;
    
    const messagesContainer = document.getElementById('chat-messages') as HTMLElement;
    if (!messagesContainer) return;

    // Check if we're still near the bottom
    const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
    const isNearBottom = scrollTop + clientHeight >= scrollHeight - 200;
    
    if (isNearBottom) {
      // Smoothly follow the content
      this.scheduleScrollUpdate();
    }
  }

  cleanup(): void {
    // Clean up scroll animation frames
    if (this.scrollState.scrollAnimationFrame) {
      cancelAnimationFrame(this.scrollState.scrollAnimationFrame);
      this.scrollState.scrollAnimationFrame = null;
    }

    // Clean up resize observer
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }
}
