// Core interfaces for the application
export interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileItem[];
  isExpanded?: boolean;
}

export interface OpenTab {
  path: string;
  name: string;
  content: string;
  language: string;
  isDirty: boolean;
}

export interface Terminal {
  id: string;
  name: string;
  workingDirectory: string;
  output: string;
  history: string[];
  isActive: boolean;
  runningProcesses: Set<string>;
  currentProcess: string;
  shell: string;
}

export interface CodebaseIndex {
  files: Map<string, CodeFile>;
  dependencies: Map<string, string[]>;
  exports: Map<string, string[]>;
  projectStructure: ProjectStructure;
  lastIndexed: Date;
}

export interface CodeFile {
  path: string;
  content: string;
  language: string;
  size: number;
  lastModified: Date;
  imports: ImportInfo[];
  exports: string[];
  functions: string[];
  classes: string[];
  types: string[];
}

export interface ImportInfo {
  source: string;
  imports: string[];
  isDefault: boolean;
  isNamespace: boolean;
}

export interface ProjectStructure {
  packageJson?: any;
  tsConfig?: any;
  gitInfo?: GitInfo;
  frameworks: string[];
  languages: string[];
}

export interface GitInfo {
  branch: string;
  hasUncommittedChanges: boolean;
  lastCommit: string;
  remoteUrl?: string;
}

export interface Project {
  path: string;
  name: string;
  lastOpened: string;
}

export interface AppState {
  currentFile: string;
  currentWorkingDirectory: string;
  showProjectSelector: boolean;
  openTabs: Map<string, OpenTab>;
  activeTabPath: string;
  terminals: Map<string, Terminal>;
  activeTerminalId: string;
  terminalCounter: number;
  terminalVisible: boolean;
  sidebarVisible: boolean;
  terminalHeight: number;
  aiChatVisible: boolean;
  monacoEditor: any;
  activeTerminalTab: 'terminal' | 'problems';
}
