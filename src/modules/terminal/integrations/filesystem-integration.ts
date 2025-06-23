export class FilesystemIntegration {
  private electronAPI: any;

  constructor() {
    this.electronAPI = (window as any).electronAPI;
  }

  initialize(): void {
    this.setupFileSystemChangeListener();
  }

  private setupFileSystemChangeListener(): void {
    if (this.electronAPI && this.electronAPI.onFileSystemChanged) {
      this.electronAPI.onFileSystemChanged((event: { type: string; path: string; parentPath: string }) => {
        console.log('📁 File system changed:', event);
        this.triggerFileTreeRefresh();
      });
    }
  }

  private triggerFileTreeRefresh(): void {
    const event = new CustomEvent('refresh-file-tree');
    document.dispatchEvent(event);
    console.log('🔄 Triggered file tree refresh');
  }

  handleFileSystemChange(event: { type: string; path: string }): void {
    console.log('File system changed:', event);
    this.triggerFileTreeRefresh();
  }
}
