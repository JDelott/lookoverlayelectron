export class QuickActions {
  private actionMap: { [key: string]: string } = {
    'explain': 'Please explain this code and what it does.',
    'debug': 'Please review this code for potential bugs, issues, or improvements.',
    'optimize': 'Please suggest optimizations to make this code more efficient.',
    'comment': 'Please add appropriate comments and documentation to this code.',
    'test': 'Please create comprehensive unit tests for this code.',
    'refactor': 'Please refactor this code to improve readability, maintainability, and follow best practices.'
  };

  handleQuickAction(action: string): void {
    const message = this.actionMap[action];
    if (message) {
      const input = document.getElementById('chat-input') as HTMLTextAreaElement;
      if (input) {
        input.value = message;
        
        // Trigger events for proper handling
        const inputEvent = new Event('input', { bubbles: true });
        input.dispatchEvent(inputEvent);
        
        input.focus();
        this.toggleQuickActions(); // Hide quick actions after selection
      }
    }
  }

  toggleQuickActions(): void {
    const quickActions = document.getElementById('quick-actions');
    if (!quickActions) return;

    const isVisible = quickActions.style.display !== 'none';
    quickActions.style.display = isVisible ? 'none' : 'block';
  }

  setupQuickActionListeners(): void {
    // Use event delegation for better performance
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('quick-action') || target.closest('.quick-action')) {
        e.preventDefault();
        e.stopPropagation();
        
        const button = target.closest('.quick-action') as HTMLElement;
        const action = button?.getAttribute('data-action');
        if (action) {
          this.handleQuickAction(action);
        }
      }
    });
  }
}
