import { AppState } from '../types/index.js';
import { TabManager } from '../tabs/index.js';

declare const monaco: typeof import('monaco-editor');

// Add type declarations for Monaco and RequireJS
declare global {
  interface Window {
    monaco: typeof import('monaco-editor');
    require: {
      config: (config: { paths: { [key: string]: string } }) => void;
      (modules: string[], onLoad: () => void, onError?: (error: any) => void): void;
    };
  }
}

export class MonacoEditorManager {
  private state: AppState;
  private tabManager: TabManager;

  constructor(state: AppState, tabManager: TabManager) {
    this.state = state;
    this.tabManager = tabManager;
  }

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.monaco) {
        this.setupMonacoConfiguration();
        this.createEditor();
        resolve();
        return;
      }

      if (window.require && window.require.config) {
        window.require.config({ 
          paths: { vs: 'https://unpkg.com/monaco-editor@0.44.0/min/vs' } 
        });
        
        window.require(['vs/editor/editor.main'], () => {
          this.setupMonacoConfiguration();
          this.createEditor();
          resolve();
        }, (error: any) => {
          console.error('Failed to load Monaco editor:', error);
          reject(error);
        });
      } else {
        console.error('RequireJS not available');
        reject(new Error('RequireJS not available'));
      }
    });
  }

  private setupMonacoConfiguration(): void {
    if (!window.monaco) return;

    console.log('🔧 Setting up Monaco TypeScript/JSX configuration...');

    // Configure TypeScript compiler options to match VS Code's defaults exactly
    const compilerOptions = {
      target: window.monaco.languages.typescript.ScriptTarget.ES2020,
      module: window.monaco.languages.typescript.ModuleKind.ESNext,
      moduleResolution: window.monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      allowNonTsExtensions: true,
      allowJs: true,
      checkJs: false,
      jsx: window.monaco.languages.typescript.JsxEmit.ReactJSX,
      jsxFactory: 'React.createElement',
      jsxFragmentFactory: 'React.Fragment',
      allowSyntheticDefaultImports: true,
      esModuleInterop: true,
      skipLibCheck: true,
      strict: false,
      noImplicitAny: false,
      strictNullChecks: false,
      strictFunctionTypes: false,
      noImplicitReturns: false,
      noImplicitThis: false,
      alwaysStrict: false,
      noUnusedLocals: false,
      noUnusedParameters: false,
      exactOptionalPropertyTypes: false,
      noImplicitOverride: false,
      useUnknownInCatchVariables: false,
      lib: ['ES2020', 'DOM', 'DOM.Iterable'],
      typeRoots: ['node_modules/@types'],
      resolveJsonModule: true,
      declaration: false,
      declarationMap: false,
      sourceMap: true,
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
      suppressImplicitAnyIndexErrors: true,
      suppressExcessPropertyErrors: true,
      forceConsistentCasingInFileNames: true
    };

    // Apply to both TypeScript and JavaScript defaults
    window.monaco.languages.typescript.typescriptDefaults.setCompilerOptions(compilerOptions);
    window.monaco.languages.typescript.javascriptDefaults.setCompilerOptions(compilerOptions);

    // Configure diagnostic options to be more permissive like VS Code
    const diagnosticOptions = {
      noSemanticValidation: false,
      noSyntaxValidation: false,
      noSuggestionDiagnostics: false,
      diagnosticCodesToIgnore: [
        // Ignore common noise errors that VS Code typically handles better
        1011, // An element access expression should take an argument
        1005, // ';' expected
        1109, // Expression expected
        1434, // Unexpected keyword or identifier
        7026, // JSX element implicitly has type 'any'
        2307, // Cannot find module 'react/jsx-runtime'
        2304, // Cannot find name 'React' (when global)
        2591, // Cannot find name 'JSX'
        2786, // 'JSX' refers to a UMD global
        6133, // Variable is declared but never used
        6196, // Parameter is declared but never used
        2339, // Property does not exist on type (often false positive)
        2322, // Type is not assignable (often false positive in React)
        2345, // Argument of type is not assignable (often false positive)
        2740, // Type is missing properties (often false positive in React)
        2741, // Property is missing in type (often false positive)
        2769, // No overload matches this call (often false positive)
        2571, // Object is of type 'unknown'
        2532, // Object is possibly 'undefined'
        2531, // Object is possibly 'null'
        18046, // Element implicitly has an 'any' type
        18047, // Element implicitly has an 'any' type
        8010, // Type annotations can only be used in TypeScript files
        8006, // 'interface' declarations can only be used in TypeScript files
      ]
    };

    window.monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions(diagnosticOptions);
    window.monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions(diagnosticOptions);

    this.addAllTypes();
    this.setupCustomValidation();

    console.log('✅ Monaco TypeScript/JSX configuration complete');
  }

  private addAllTypes(): void {
    if (!window.monaco) return;

    const allTypes = `
// React Types
declare module "react" {
  export interface ReactElement<P = any> {
    type: string | ComponentType<P>;
    props: P;
    key: string | number | null;
  }
  
  export type ReactNode = ReactElement | string | number | boolean | null | undefined | ReactNode[];
  export type ComponentType<P = {}> = ComponentClass<P> | FunctionComponent<P>;
  export interface ComponentClass<P = {}> { new (props: P): Component<P>; }
  export interface FunctionComponent<P = {}> { (props: P): ReactElement | null; }
  export interface Component<P = {}, S = {}> { props: P; state: S; render(): ReactNode; }
  
  export function createElement<P>(type: string | ComponentType<P>, props?: P | null, ...children: ReactNode[]): ReactElement<P>;
  export const Fragment: ComponentType<{}>;
  export function useState<T>(initialState: T | (() => T)): [T, (value: T | ((prev: T) => T)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: any[]): void;
  export function useContext<T>(context: Context<T>): T;
  export function useMemo<T>(factory: () => T, deps: any[]): T;
  export function useCallback<T extends (...args: any[]) => any>(callback: T, deps: any[]): T;
  export function useRef<T>(initialValue: T): MutableRefObject<T>;
  export function useRef<T = undefined>(): MutableRefObject<T | undefined>;
  
  export interface Context<T> {
    Provider: ComponentType<{ value: T; children?: ReactNode }>;
    Consumer: ComponentType<{ children: (value: T) => ReactNode }>;
  }
  
  export function createContext<T>(defaultValue: T): Context<T>;
  export interface MutableRefObject<T> { current: T; }
  export interface RefObject<T> { readonly current: T | null; }
}

// Global JSX namespace
declare global {
  namespace JSX {
    interface Element extends React.ReactElement<any, any> {}
    interface ElementClass extends React.Component<any, any> {}
    interface ElementAttributesProperty { props: {}; }
    interface ElementChildrenAttribute { children: {}; }
    
    interface IntrinsicElements {
      div: React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>;
      span: React.DetailedHTMLProps<React.HTMLAttributes<HTMLSpanElement>, HTMLSpanElement>;
      h1: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
      h2: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
      h3: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
      h4: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
      h5: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
      h6: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
      p: React.DetailedHTMLProps<React.HTMLAttributes<HTMLParagraphElement>, HTMLParagraphElement>;
      a: React.DetailedHTMLProps<React.AnchorHTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement>;
      button: React.DetailedHTMLProps<React.ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>;
      input: React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>;
      textarea: React.DetailedHTMLProps<React.TextareaHTMLAttributes<HTMLTextAreaElement>, HTMLTextAreaElement>;
      select: React.DetailedHTMLProps<React.SelectHTMLAttributes<HTMLSelectElement>, HTMLSelectElement>;
      option: React.DetailedHTMLProps<React.OptionHTMLAttributes<HTMLOptionElement>, HTMLOptionElement>;
      form: React.DetailedHTMLProps<React.FormHTMLAttributes<HTMLFormElement>, HTMLFormElement>;
      img: React.DetailedHTMLProps<React.ImgHTMLAttributes<HTMLImageElement>, HTMLImageElement>;
      ul: React.DetailedHTMLProps<React.HTMLAttributes<HTMLUListElement>, HTMLUListElement>;
      ol: React.DetailedHTMLProps<React.OlHTMLAttributes<HTMLOListElement>, HTMLOListElement>;
      li: React.DetailedHTMLProps<React.LiHTMLAttributes<HTMLLIElement>, HTMLLIElement>;
      table: React.DetailedHTMLProps<React.TableHTMLAttributes<HTMLTableElement>, HTMLTableElement>;
      thead: React.DetailedHTMLProps<React.HTMLAttributes<HTMLTableSectionElement>, HTMLTableSectionElement>;
      tbody: React.DetailedHTMLProps<React.HTMLAttributes<HTMLTableSectionElement>, HTMLTableSectionElement>;
      tr: React.DetailedHTMLProps<React.HTMLAttributes<HTMLTableRowElement>, HTMLTableRowElement>;
      td: React.DetailedHTMLProps<React.TdHTMLAttributes<HTMLTableDataCellElement>, HTMLTableDataCellElement>;
      th: React.DetailedHTMLProps<React.ThHTMLAttributes<HTMLTableHeaderCellElement>, HTMLTableHeaderCellElement>;
      nav: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      header: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      footer: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      main: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      section: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      article: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      aside: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      video: React.DetailedHTMLProps<React.VideoHTMLAttributes<HTMLVideoElement>, HTMLVideoElement>;
      audio: React.DetailedHTMLProps<React.AudioHTMLAttributes<HTMLAudioElement>, HTMLAudioElement>;
      canvas: React.DetailedHTMLProps<React.CanvasHTMLAttributes<HTMLCanvasElement>, HTMLCanvasElement>;
      [elemName: string]: any;
    }
  }
  
  // Window and DOM globals
  interface Window {
    electronAPI: any;
    monaco: any;
    require: any;
    app?: any;
    layoutManager?: any;
    chatManager?: any;
  }
  
  interface Document {
    getElementById(id: string): HTMLElement | null;
    querySelector(selector: string): Element | null;
    querySelectorAll(selector: string): NodeListOf<Element>;
    createElement(tagName: string): HTMLElement;
    addEventListener(type: string, listener: EventListener): void;
    removeEventListener(type: string, listener: EventListener): void;
    body: HTMLBodyElement;
    head: HTMLHeadElement;
    readyState: string;
  }
  
  interface Element {
    innerHTML: string;
    textContent: string | null;
    className: string;
    classList: DOMTokenList;
    style: CSSStyleDeclaration;
    addEventListener(type: string, listener: EventListener): void;
    removeEventListener(type: string, listener: EventListener): void;
    appendChild(child: Node): Node;
    removeChild(child: Node): Node;
    querySelector(selector: string): Element | null;
    querySelectorAll(selector: string): NodeListOf<Element>;
    getAttribute(name: string): string | null;
    setAttribute(name: string, value: string): void;
    removeAttribute(name: string): void;
    closest(selector: string): Element | null;
  }
  
  interface HTMLElement extends Element {
    onclick: ((this: GlobalEventHandlers, ev: MouseEvent) => any) | null;
    onchange: ((this: GlobalEventHandlers, ev: Event) => any) | null;
    onkeydown: ((this: GlobalEventHandlers, ev: KeyboardEvent) => any) | null;
    onkeyup: ((this: GlobalEventHandlers, ev: KeyboardEvent) => any) | null;
    focus(): void;
    blur(): void;
    click(): void;
    scrollTop: number;
    scrollHeight: number;
    offsetWidth: number;
    offsetHeight: number;
    clientWidth: number;
    clientHeight: number;
  }
  
  var console: {
    log(...data: any[]): void;
    error(...data: any[]): void;
    warn(...data: any[]): void;
    info(...data: any[]): void;
    debug(...data: any[]): void;
  };
  
  var document: Document;
  var window: Window;
  
  function setTimeout(callback: (...args: any[]) => void, ms?: number, ...args: any[]): number;
  function clearTimeout(timeoutId: number): void;
  function setInterval(callback: (...args: any[]) => void, ms?: number, ...args: any[]): number;
  function clearInterval(intervalId: number): void;
  function requestAnimationFrame(callback: FrameRequestCallback): number;
  function cancelAnimationFrame(handle: number): void;
  
  interface FrameRequestCallback { (time: number): void; }
  
  // Event types
  interface Event {
    type: string;
    target: EventTarget | null;
    currentTarget: EventTarget | null;
    preventDefault(): void;
    stopPropagation(): void;
    stopImmediatePropagation(): void;
  }
  
  interface MouseEvent extends Event {
    clientX: number;
    clientY: number;
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    metaKey: boolean;
    button: number;
    buttons: number;
  }
  
  interface KeyboardEvent extends Event {
    key: string;
    code: string;
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    metaKey: boolean;
    repeat: boolean;
  }
  
  interface EventTarget {
    addEventListener(type: string, listener: EventListener | null, options?: boolean | AddEventListenerOptions): void;
    removeEventListener(type: string, listener: EventListener | null, options?: boolean | EventListenerOptions): void;
    dispatchEvent(event: Event): boolean;
  }
  
  interface EventListener { (evt: Event): void; }
  interface AddEventListenerOptions { capture?: boolean; once?: boolean; passive?: boolean; }
  interface EventListenerOptions { capture?: boolean; }
}

// React namespace for attributes
declare namespace React {
  interface HTMLAttributes<T> {
    accessKey?: string;
    className?: string;
    contentEditable?: boolean | "true" | "false" | "inherit";
    contextMenu?: string;
    dir?: string;
    draggable?: boolean;
    hidden?: boolean;
    id?: string;
    lang?: string;
    slot?: string;
    spellCheck?: boolean;
    style?: CSSProperties;
    tabIndex?: number;
    title?: string;
    translate?: 'yes' | 'no';
    
    children?: ReactNode;
    dangerouslySetInnerHTML?: { __html: string };
    key?: Key;
    ref?: Ref<T>;
    
    onClick?: MouseEventHandler<T>;
    onDoubleClick?: MouseEventHandler<T>;
    onMouseDown?: MouseEventHandler<T>;
    onMouseUp?: MouseEventHandler<T>;
    onMouseMove?: MouseEventHandler<T>;
    onMouseOver?: MouseEventHandler<T>;
    onMouseOut?: MouseEventHandler<T>;
    onMouseEnter?: MouseEventHandler<T>;
    onMouseLeave?: MouseEventHandler<T>;
    
    onKeyDown?: KeyboardEventHandler<T>;
    onKeyUp?: KeyboardEventHandler<T>;
    onKeyPress?: KeyboardEventHandler<T>;
    
    onChange?: ChangeEventHandler<T>;
    onInput?: FormEventHandler<T>;
    onSubmit?: FormEventHandler<T>;
    onFocus?: FocusEventHandler<T>;
    onBlur?: FocusEventHandler<T>;
    
    onTouchStart?: TouchEventHandler<T>;
    onTouchEnd?: TouchEventHandler<T>;
    onTouchMove?: TouchEventHandler<T>;
    onTouchCancel?: TouchEventHandler<T>;
  }
  
  interface CSSProperties { [key: string]: any; }
  
  type Key = string | number;
  type Ref<T> = RefObject<T> | ((instance: T | null) => void) | null;
  
  type SyntheticEvent<T = Element> = {
    currentTarget: T;
    target: EventTarget & T;
    preventDefault(): void;
    stopPropagation(): void;
  };
  
  type MouseEventHandler<T = Element> = (event: SyntheticEvent<T>) => void;
  type KeyboardEventHandler<T = Element> = (event: SyntheticEvent<T>) => void;
  type ChangeEventHandler<T = Element> = (event: SyntheticEvent<T>) => void;
  type FormEventHandler<T = Element> = (event: SyntheticEvent<T>) => void;
  type FocusEventHandler<T = Element> = (event: SyntheticEvent<T>) => void;
  type TouchEventHandler<T = Element> = (event: SyntheticEvent<T>) => void;
  
  interface DetailedHTMLProps<E extends HTMLAttributes<T>, T> extends E { ref?: Ref<T>; }
  
  interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
    accept?: string; alt?: string; autoComplete?: string; autoFocus?: boolean;
    capture?: boolean | string; checked?: boolean; crossOrigin?: string;
    disabled?: boolean; form?: string; formAction?: string; formEncType?: string;
    formMethod?: string; formNoValidate?: boolean; formTarget?: string;
    height?: number | string; list?: string; max?: number | string;
    maxLength?: number; min?: number | string; minLength?: number;
    multiple?: boolean; name?: string; pattern?: string; placeholder?: string;
    readOnly?: boolean; required?: boolean; size?: number; src?: string;
    step?: number | string; type?: string; value?: string | ReadonlyArray<string> | number;
    width?: number | string;
  }
  
  interface ButtonHTMLAttributes<T> extends HTMLAttributes<T> {
    autoFocus?: boolean; disabled?: boolean; form?: string; formAction?: string;
    formEncType?: string; formMethod?: string; formNoValidate?: boolean;
    formTarget?: string; name?: string; type?: 'submit' | 'reset' | 'button';
    value?: string | ReadonlyArray<string> | number;
  }
  
  interface AnchorHTMLAttributes<T> extends HTMLAttributes<T> {
    download?: any; href?: string; hrefLang?: string; media?: string;
    ping?: string; rel?: string; target?: string; type?: string;
    referrerPolicy?: string;
  }
  
  interface VideoHTMLAttributes<T> extends HTMLAttributes<T> {
    autoPlay?: boolean; controls?: boolean; crossOrigin?: string;
    height?: number | string; loop?: boolean; muted?: boolean;
    poster?: string; preload?: string; src?: string; width?: number | string;
  }
  
  interface TextareaHTMLAttributes<T> extends HTMLAttributes<T> {
    autoComplete?: string; autoFocus?: boolean; cols?: number;
    dirName?: string; disabled?: boolean; form?: string; maxLength?: number;
    minLength?: number; name?: string; placeholder?: string; readOnly?: boolean;
    required?: boolean; rows?: number; value?: string | ReadonlyArray<string> | number;
    wrap?: string;
  }
  
  interface SelectHTMLAttributes<T> extends HTMLAttributes<T> {
    autoComplete?: string; autoFocus?: boolean; disabled?: boolean;
    form?: string; multiple?: boolean; name?: string; required?: boolean;
    size?: number; value?: string | ReadonlyArray<string> | number;
  }
  
  interface OptionHTMLAttributes<T> extends HTMLAttributes<T> {
    disabled?: boolean; label?: string; selected?: boolean;
    value?: string | ReadonlyArray<string> | number;
  }
  
  interface FormHTMLAttributes<T> extends HTMLAttributes<T> {
    acceptCharset?: string; action?: string; autoComplete?: string;
    encType?: string; method?: string; name?: string; noValidate?: boolean;
    target?: string;
  }
  
  interface ImgHTMLAttributes<T> extends HTMLAttributes<T> {
    alt?: string; crossOrigin?: "anonymous" | "use-credentials" | "";
    decoding?: "async" | "auto" | "sync"; height?: number | string;
    loading?: "eager" | "lazy"; referrerPolicy?: string; sizes?: string;
    src?: string; srcSet?: string; useMap?: string; width?: number | string;
  }
  
  interface LiHTMLAttributes<T> extends HTMLAttributes<T> { value?: string | ReadonlyArray<string> | number; }
  interface OlHTMLAttributes<T> extends HTMLAttributes<T> { reversed?: boolean; start?: number; type?: '1' | 'a' | 'A' | 'i' | 'I'; }
  interface TableHTMLAttributes<T> extends HTMLAttributes<T> { cellPadding?: number | string; cellSpacing?: number | string; summary?: string; }
  interface TdHTMLAttributes<T> extends HTMLAttributes<T> { align?: "left" | "center" | "right" | "justify" | "char"; colSpan?: number; headers?: string; rowSpan?: number; scope?: string; }
  interface ThHTMLAttributes<T> extends HTMLAttributes<T> { align?: "left" | "center" | "right" | "justify" | "char"; colSpan?: number; headers?: string; rowSpan?: number; scope?: string; abbr?: string; }
  
  interface SVGProps<T> extends HTMLAttributes<T> {
    fill?: string; stroke?: string; strokeWidth?: number | string;
    strokeLinecap?: 'butt' | 'round' | 'square' | 'inherit';
    strokeLinejoin?: 'miter' | 'round' | 'bevel' | 'inherit';
    strokeDasharray?: string | number; strokeDashoffset?: string | number;
    x?: number | string; y?: number | string; cx?: number | string; cy?: number | string;
    r?: number | string; rx?: number | string; ry?: number | string;
    width?: number | string; height?: number | string; viewBox?: string;
    xmlns?: string; d?: string; points?: string; transform?: string;
  }
}
`;

    window.monaco.languages.typescript.typescriptDefaults.addExtraLib(
      allTypes,
      'file:///global-types.d.ts'
    );
  }

  private setupCustomValidation(): void {
    if (!window.monaco) return;

    // Register a code action provider for auto-fixes
    window.monaco.languages.registerCodeActionProvider('typescript', {
      provideCodeActions: (model, range, context) => {
        const actions: any[] = [];
        
        // Auto-fix for missing React import
        if (context.markers.some(marker => marker.message.includes('Cannot find name \'React\''))) {
          actions.push({
            title: 'Add React import',
            kind: 'quickfix',
            edit: {
              edits: [{
                resource: model.uri,
                edit: {
                  range: new window.monaco.Range(1, 1, 1, 1),
                  text: 'import React from \'react\';\n'
                }
              }]
            }
          });
        }

        return { actions, dispose: () => {} };
      }
    });

    // Register completion provider
    window.monaco.languages.registerCompletionItemProvider('typescript', {
      provideCompletionItems: (model, position) => {
        const suggestions: any[] = [];
        
        suggestions.push({
          label: 'React Component',
          kind: window.monaco.languages.CompletionItemKind.Snippet,
          insertText: `import React from 'react';\n\ninterface Props {\n  \${1:prop}: \${2:string};\n}\n\nconst \${3:ComponentName}: React.FC<Props> = ({ \${1:prop} }) => {\n  return (\n    <div>\n      \${4:// component content}\n    </div>\n  );\n};\n\nexport default \${3:ComponentName};`,
          insertTextRules: window.monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Create a React functional component'
        });

        return { suggestions };
      }
    });
  }

  private createEditor(): void {
    const container = document.getElementById('editor-container');
    if (!container || !window.monaco) {
      console.error('❌ Cannot create editor: container or Monaco not available');
      return;
    }

    try {
      this.state.monacoEditor = window.monaco.editor.create(container, {
        value: '// Welcome to Lightweight IDE\n// Select a file to start editing',
        language: 'typescript',
        theme: 'vs-dark',
        fontSize: 14,
        wordWrap: 'on',
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        insertSpaces: true,
        detectIndentation: true,
        formatOnPaste: true,
        formatOnType: true
      });

      // Expose the Monaco editor globally for other modules to access
      (window as any).monacoEditor = this.state.monacoEditor;
      (window as any).monacoEditorManager = this;
      console.log('✅ Monaco editor exposed globally');

      this.setupKeybindings();
      this.setupContentChangeHandling();

      console.log('✅ Monaco editor initialized with full TypeScript/JSX support');
    } catch (error) {
      console.error('❌ Failed to create Monaco editor:', error);
    }
  }

  private setupKeybindings(): void {
    if (!this.state.monacoEditor || !window.monaco) return;

    // Cmd/Ctrl + S - Save file
    this.state.monacoEditor.addCommand(
      window.monaco.KeyMod.CtrlCmd | window.monaco.KeyCode.KeyS,
      () => this.saveCurrentFile()
    );

    // Cmd/Ctrl + W - Close tab
    this.state.monacoEditor.addCommand(
      window.monaco.KeyMod.CtrlCmd | window.monaco.KeyCode.KeyW,
      () => {
        if (this.state.activeTabPath) {
          this.tabManager.closeTab(this.state.activeTabPath);
        }
      }
    );

    // Cmd/Ctrl + / - Toggle line comment
    this.state.monacoEditor.addCommand(
      window.monaco.KeyMod.CtrlCmd | window.monaco.KeyCode.Slash,
      () => {
        this.state.monacoEditor?.trigger('keyboard', 'editor.action.commentLine', {});
      }
    );

    // Shift + Alt + F - Format document
    this.state.monacoEditor.addCommand(
      window.monaco.KeyMod.Shift | window.monaco.KeyMod.Alt | window.monaco.KeyCode.KeyF,
      () => {
        this.state.monacoEditor?.trigger('keyboard', 'editor.action.formatDocument', {});
      }
    );

    // Additional useful shortcuts
    
    // Cmd/Ctrl + D - Select next occurrence
    this.state.monacoEditor.addCommand(
      window.monaco.KeyMod.CtrlCmd | window.monaco.KeyCode.KeyD,
      () => {
        this.state.monacoEditor?.trigger('keyboard', 'editor.action.addSelectionToNextFindMatch', {});
      }
    );

    // Cmd/Ctrl + Shift + K - Delete line
    this.state.monacoEditor.addCommand(
      window.monaco.KeyMod.CtrlCmd | window.monaco.KeyMod.Shift | window.monaco.KeyCode.KeyK,
      () => {
        this.state.monacoEditor?.trigger('keyboard', 'editor.action.deleteLines', {});
      }
    );

    // Alt + Up/Down - Move line up/down
    this.state.monacoEditor.addCommand(
      window.monaco.KeyMod.Alt | window.monaco.KeyCode.UpArrow,
      () => {
        this.state.monacoEditor?.trigger('keyboard', 'editor.action.moveLinesUpAction', {});
      }
    );

    this.state.monacoEditor.addCommand(
      window.monaco.KeyMod.Alt | window.monaco.KeyCode.DownArrow,
      () => {
        this.state.monacoEditor?.trigger('keyboard', 'editor.action.moveLinesDownAction', {});
      }
    );

    // Cmd/Ctrl + Shift + \ - Go to matching bracket
    this.state.monacoEditor.addCommand(
      window.monaco.KeyMod.CtrlCmd | window.monaco.KeyMod.Shift | window.monaco.KeyCode.Backslash,
      () => {
        this.state.monacoEditor?.trigger('keyboard', 'editor.action.jumpToBracket', {});
      }
    );

    // Cmd/Ctrl + ] / [ - Indent/Outdent
    this.state.monacoEditor.addCommand(
      window.monaco.KeyMod.CtrlCmd | window.monaco.KeyCode.BracketRight,
      () => {
        this.state.monacoEditor?.trigger('keyboard', 'editor.action.indentLines', {});
      }
    );

    this.state.monacoEditor.addCommand(
      window.monaco.KeyMod.CtrlCmd | window.monaco.KeyCode.BracketLeft,
      () => {
        this.state.monacoEditor?.trigger('keyboard', 'editor.action.outdentLines', {});
      }
    );
  }

  private setupContentChangeHandling(): void {
    if (!this.state.monacoEditor) return;

    // Add debounced content synchronization to prevent excessive updates
    let updateTimeout: NodeJS.Timeout;
    
    this.state.monacoEditor.onDidChangeModelContent(() => {
      if (this.state.activeTabPath) {
        // Mark tab as dirty immediately
        this.tabManager.markTabAsDirty(this.state.activeTabPath);
        
        // Debounce content synchronization to avoid performance issues
        clearTimeout(updateTimeout);
        updateTimeout = setTimeout(() => {
          this.syncCurrentContentToTab();
        }, 100); // 100ms debounce
      }
    });
  }

  // Add this new method to sync content
  private syncCurrentContentToTab(): void {
    if (!this.state.monacoEditor || !this.state.activeTabPath) return;
    
    const currentTab = this.state.openTabs.get(this.state.activeTabPath);
    if (currentTab) {
      const currentContent = this.state.monacoEditor.getValue();
      currentTab.content = currentContent;
      console.log('🔄 Content synchronized to tab:', this.state.activeTabPath);
    }
  }

  public async saveCurrentFile(): Promise<void> {
    if (!this.state.activeTabPath || !this.state.monacoEditor) {
      console.log('⚠️ No active tab or editor not available');
      return;
    }

    try {
      // First sync the current content to tab state
      this.syncCurrentContentToTab();
      
      const content = this.state.monacoEditor.getValue();
      const currentTab = this.state.openTabs.get(this.state.activeTabPath);
      
      if (!currentTab) {
        console.error('❌ No tab found for active file:', this.state.activeTabPath);
        return;
      }

      // Ensure tab content is up to date
      currentTab.content = content;
      
      const electronAPI = (window as any).electronAPI;
      if (!electronAPI) {
        console.error('❌ Electron API not available');
        return;
      }

      console.log('💾 Saving file:', this.state.activeTabPath, 'Content length:', content.length);
      
      const result = await electronAPI.writeFile(this.state.activeTabPath, content);
      
      if (result && result.success) {
        this.tabManager.markTabAsClean(this.state.activeTabPath);
        this.showSaveIndicator();
        console.log('✅ File saved successfully:', this.state.activeTabPath);
        
        // Dispatch file-saved event for git manager
        const event = new CustomEvent('file-saved', { 
          detail: { filePath: this.state.activeTabPath, content } 
        });
        document.dispatchEvent(event);
      } else {
        const errorMsg = result?.error || 'Unknown error occurred';
        console.error('❌ Failed to save file:', errorMsg);
        alert(`Failed to save file: ${errorMsg}`);
      }
    } catch (error) {
      console.error('❌ Error saving file:', error);
      alert(`Error saving file: ${error}`);
    }
  }

  // Add this method to be called before tab switches
  public syncContentBeforeTabSwitch(): void {
    this.syncCurrentContentToTab();
  }

  private showSaveIndicator(): void {
    const indicator = document.createElement('div');
    indicator.textContent = '✅ Saved';
    indicator.style.cssText = `
      position: fixed; top: 60px; right: 20px; background: #4ade80;
      color: white; padding: 8px 16px; border-radius: 4px; z-index: 1000;
      transition: opacity 0.3s;
    `;
    
    document.body.appendChild(indicator);
    
    setTimeout(() => {
      indicator.style.opacity = '0';
      setTimeout(() => indicator.remove(), 300);
    }, 2000);
  }

  updateLanguage(language: string): void {
    if (this.state.monacoEditor && window.monaco) {
      const model = this.state.monacoEditor.getModel();
      if (model) {
        window.monaco.editor.setModelLanguage(model, language);
      }
    }
  }

  focus(): void {
    if (this.state.monacoEditor) {
      this.state.monacoEditor.focus();
    }
  }

  dispose(): void {
    if (this.state.monacoEditor) {
      this.state.monacoEditor.dispose();
      this.state.monacoEditor = null;
    }
  }
}
