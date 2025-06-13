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
      noImplicitAny: true,        // Enable this to show implicit any errors
      strictNullChecks: true,
      strictFunctionTypes: true,  // Enable this for better type checking
      noImplicitReturns: true,    // Enable this to catch missing returns
      noImplicitThis: false,
      alwaysStrict: false,
      noUnusedLocals: true,       // This should show unused variable errors
      noUnusedParameters: true,   // This should show unused parameter errors
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
      suppressImplicitAnyIndexErrors: false,
      suppressExcessPropertyErrors: false,
      forceConsistentCasingInFileNames: true
    };

    // Apply to both TypeScript and JavaScript defaults
    window.monaco.languages.typescript.typescriptDefaults.setCompilerOptions(compilerOptions);
    window.monaco.languages.typescript.javascriptDefaults.setCompilerOptions(compilerOptions);

    // Configure diagnostic options - ONLY ignore browser-specific false positives
    const diagnosticOptions = {
      noSemanticValidation: false,
      noSyntaxValidation: false,
      noSuggestionDiagnostics: false,
      diagnosticCodesToIgnore: [
        // ONLY ignore these specific Monaco/browser-specific false positives
        2307, // Cannot find module (module resolution differences)
        2304, // Cannot find name 'React' (when using global React)
        2591, // Cannot find name 'JSX'
        2786, // 'JSX' refers to a UMD global
        18046, // Element implicitly has an 'any' type (JSX specific)
        18047, // Element implicitly has an 'any' type (JSX specific)
        7026, // JSX element implicitly has type 'any' because no interface 'JSX.IntrinsicElements' exists
      ]
    };

    window.monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions(diagnosticOptions);
    window.monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions(diagnosticOptions);

    // Force Monaco to treat .tsx files as TypeScript and enable eager model sync
    window.monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);
    window.monaco.languages.typescript.javascriptDefaults.setEagerModelSync(true);

    // Add a custom diagnostic filter to handle file-specific issues
    this.setupDiagnosticFiltering();

    this.addAllTypes();
    this.setupCustomValidation();

    console.log('✅ Monaco TypeScript/JSX configuration complete');
  }

  private setupDiagnosticFiltering(): void {
    if (!window.monaco) return;

    // Override the marker creation to filter out false positives based on file context
    const originalSetModelMarkers = window.monaco.editor.setModelMarkers;
    
    window.monaco.editor.setModelMarkers = (model: any, owner: string, markers: any[]) => {
      const filteredMarkers = markers.filter(marker => {
        const modelUri = model.uri.toString();
        const modelLanguage = model.getLanguageId();
        
        // Check if this is a TypeScript file by multiple methods:
        // 1. Language ID is 'typescript'
        // 2. URI contains .ts or .tsx
        // 3. Check the current active tab path for .ts/.tsx extension
        const isTypeScriptFile = modelLanguage === 'typescript' || 
                                 modelUri.includes('.ts') || 
                                 modelUri.includes('.tsx') ||
                                 this.isCurrentFileTypeScript();
        
        console.log(`🔍 Diagnostic filtering - URI: ${modelUri}, Language: ${modelLanguage}, IsTS: ${isTypeScriptFile}`);
        
        // Only filter out 8010 and 8006 if we're sure this is a TypeScript file
        if (isTypeScriptFile && (marker.code === 8010 || marker.code === 8006)) {
          console.log('🚫 Filtering false positive TS error in TypeScript file:', marker.code, marker.message);
          return false;
        }
        
        return true;
      });
      
      return originalSetModelMarkers.call(window.monaco.editor, model, owner, filteredMarkers);
    };
  }

  private isCurrentFileTypeScript(): boolean {
    // Check if the current active tab is a TypeScript file
    const activeTabPath = this.state.activeTabPath;
    if (activeTabPath) {
      const extension = activeTabPath.split('.').pop()?.toLowerCase();
      return ['ts', 'tsx'].includes(extension || '');
    }
    
    // Also check the tab manager's active tab
    const app = (window as any).app;
    const currentFile = app?.state?.activeTabPath || app?.tabManager?.state?.activeTabPath;
    if (currentFile) {
      const extension = currentFile.split('.').pop()?.toLowerCase();
      return ['ts', 'tsx'].includes(extension || '');
    }
    
    return false;
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

  // Add all the HTML attribute interfaces
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

// CRITICAL: Global JSX namespace - this fixes the 7026 error
declare global {
  namespace JSX {
    interface Element extends React.ReactElement<any, any> {}
    interface ElementClass extends React.Component<any, any> {}
    interface ElementAttributesProperty { props: {}; }
    interface ElementChildrenAttribute { children: {}; }
    
    // COMPLETE IntrinsicElements interface - this is what was missing!
    interface IntrinsicElements {
      // HTML Elements
      a: React.DetailedHTMLProps<React.AnchorHTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement>;
      abbr: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      address: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      area: React.DetailedHTMLProps<React.AreaHTMLAttributes<HTMLAreaElement>, HTMLAreaElement>;
      article: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      aside: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      audio: React.DetailedHTMLProps<React.AudioHTMLAttributes<HTMLAudioElement>, HTMLAudioElement>;
      b: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      base: React.DetailedHTMLProps<React.BaseHTMLAttributes<HTMLBaseElement>, HTMLBaseElement>;
      bdi: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      bdo: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      big: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      blockquote: React.DetailedHTMLProps<React.BlockquoteHTMLAttributes<HTMLElement>, HTMLElement>;
      body: React.DetailedHTMLProps<React.HTMLAttributes<HTMLBodyElement>, HTMLBodyElement>;
      br: React.DetailedHTMLProps<React.HTMLAttributes<HTMLBRElement>, HTMLBRElement>;
      button: React.DetailedHTMLProps<React.ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>;
      canvas: React.DetailedHTMLProps<React.CanvasHTMLAttributes<HTMLCanvasElement>, HTMLCanvasElement>;
      caption: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      cite: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      code: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      col: React.DetailedHTMLProps<React.ColHTMLAttributes<HTMLTableColElement>, HTMLTableColElement>;
      colgroup: React.DetailedHTMLProps<React.ColgroupHTMLAttributes<HTMLTableColElement>, HTMLTableColElement>;
      data: React.DetailedHTMLProps<React.DataHTMLAttributes<HTMLDataElement>, HTMLDataElement>;
      datalist: React.DetailedHTMLProps<React.HTMLAttributes<HTMLDataListElement>, HTMLDataListElement>;
      dd: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      del: React.DetailedHTMLProps<React.DelHTMLAttributes<HTMLElement>, HTMLElement>;
      details: React.DetailedHTMLProps<React.DetailsHTMLAttributes<HTMLElement>, HTMLElement>;
      dfn: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      dialog: React.DetailedHTMLProps<React.DialogHTMLAttributes<HTMLDialogElement>, HTMLDialogElement>;
      div: React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>;
      dl: React.DetailedHTMLProps<React.HTMLAttributes<HTMLDListElement>, HTMLDListElement>;
      dt: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      em: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      embed: React.DetailedHTMLProps<React.EmbedHTMLAttributes<HTMLEmbedElement>, HTMLEmbedElement>;
      fieldset: React.DetailedHTMLProps<React.FieldsetHTMLAttributes<HTMLFieldSetElement>, HTMLFieldSetElement>;
      figcaption: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      figure: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      footer: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      form: React.DetailedHTMLProps<React.FormHTMLAttributes<HTMLFormElement>, HTMLFormElement>;
      h1: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
      h2: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
      h3: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
      h4: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
      h5: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
      h6: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
      head: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadElement>, HTMLHeadElement>;
      header: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      hgroup: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      hr: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHRElement>, HTMLHRElement>;
      html: React.DetailedHTMLProps<React.HtmlHTMLAttributes<HTMLHtmlElement>, HTMLHtmlElement>;
      i: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      iframe: React.DetailedHTMLProps<React.IframeHTMLAttributes<HTMLIFrameElement>, HTMLIFrameElement>;
      img: React.DetailedHTMLProps<React.ImgHTMLAttributes<HTMLImageElement>, HTMLImageElement>;
      input: React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>;
      ins: React.DetailedHTMLProps<React.InsHTMLAttributes<HTMLModElement>, HTMLModElement>;
      kbd: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      keygen: React.DetailedHTMLProps<React.KeygenHTMLAttributes<HTMLElement>, HTMLElement>;
      label: React.DetailedHTMLProps<React.LabelHTMLAttributes<HTMLLabelElement>, HTMLLabelElement>;
      legend: React.DetailedHTMLProps<React.HTMLAttributes<HTMLLegendElement>, HTMLLegendElement>;
      li: React.DetailedHTMLProps<React.LiHTMLAttributes<HTMLLIElement>, HTMLLIElement>;
      link: React.DetailedHTMLProps<React.LinkHTMLAttributes<HTMLLinkElement>, HTMLLinkElement>;
      main: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      map: React.DetailedHTMLProps<React.MapHTMLAttributes<HTMLMapElement>, HTMLMapElement>;
      mark: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      menu: React.DetailedHTMLProps<React.MenuHTMLAttributes<HTMLElement>, HTMLElement>;
      menuitem: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      meta: React.DetailedHTMLProps<React.MetaHTMLAttributes<HTMLMetaElement>, HTMLMetaElement>;
      meter: React.DetailedHTMLProps<React.MeterHTMLAttributes<HTMLElement>, HTMLElement>;
      nav: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      noscript: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      object: React.DetailedHTMLProps<React.ObjectHTMLAttributes<HTMLObjectElement>, HTMLObjectElement>;
      ol: React.DetailedHTMLProps<React.OlHTMLAttributes<HTMLOListElement>, HTMLOListElement>;
      optgroup: React.DetailedHTMLProps<React.OptgroupHTMLAttributes<HTMLOptGroupElement>, HTMLOptGroupElement>;
      option: React.DetailedHTMLProps<React.OptionHTMLAttributes<HTMLOptionElement>, HTMLOptionElement>;
      output: React.DetailedHTMLProps<React.OutputHTMLAttributes<HTMLElement>, HTMLElement>;
      p: React.DetailedHTMLProps<React.HTMLAttributes<HTMLParagraphElement>, HTMLParagraphElement>;
      param: React.DetailedHTMLProps<React.ParamHTMLAttributes<HTMLParamElement>, HTMLParamElement>;
      picture: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      pre: React.DetailedHTMLProps<React.HTMLAttributes<HTMLPreElement>, HTMLPreElement>;
      progress: React.DetailedHTMLProps<React.ProgressHTMLAttributes<HTMLProgressElement>, HTMLProgressElement>;
      q: React.DetailedHTMLProps<React.QuoteHTMLAttributes<HTMLQuoteElement>, HTMLQuoteElement>;
      rp: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      rt: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      ruby: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      s: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      samp: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      script: React.DetailedHTMLProps<React.ScriptHTMLAttributes<HTMLScriptElement>, HTMLScriptElement>;
      section: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      select: React.DetailedHTMLProps<React.SelectHTMLAttributes<HTMLSelectElement>, HTMLSelectElement>;
      small: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      source: React.DetailedHTMLProps<React.SourceHTMLAttributes<HTMLSourceElement>, HTMLSourceElement>;
      span: React.DetailedHTMLProps<React.HTMLAttributes<HTMLSpanElement>, HTMLSpanElement>;
      strong: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      style: React.DetailedHTMLProps<React.StyleHTMLAttributes<HTMLStyleElement>, HTMLStyleElement>;
      sub: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      summary: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      sup: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      table: React.DetailedHTMLProps<React.TableHTMLAttributes<HTMLTableElement>, HTMLTableElement>;
      tbody: React.DetailedHTMLProps<React.HTMLAttributes<HTMLTableSectionElement>, HTMLTableSectionElement>;
      td: React.DetailedHTMLProps<React.TdHTMLAttributes<HTMLTableDataCellElement>, HTMLTableDataCellElement>;
      textarea: React.DetailedHTMLProps<React.TextareaHTMLAttributes<HTMLTextAreaElement>, HTMLTextAreaElement>;
      tfoot: React.DetailedHTMLProps<React.HTMLAttributes<HTMLTableSectionElement>, HTMLTableSectionElement>;
      th: React.DetailedHTMLProps<React.ThHTMLAttributes<HTMLTableHeaderCellElement>, HTMLTableHeaderCellElement>;
      thead: React.DetailedHTMLProps<React.HTMLAttributes<HTMLTableSectionElement>, HTMLTableSectionElement>;
      time: React.DetailedHTMLProps<React.TimeHTMLAttributes<HTMLElement>, HTMLElement>;
      title: React.DetailedHTMLProps<React.HTMLAttributes<HTMLTitleElement>, HTMLTitleElement>;
      tr: React.DetailedHTMLProps<React.HTMLAttributes<HTMLTableRowElement>, HTMLTableRowElement>;
      track: React.DetailedHTMLProps<React.TrackHTMLAttributes<HTMLTrackElement>, HTMLTrackElement>;
      u: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      ul: React.DetailedHTMLProps<React.HTMLAttributes<HTMLUListElement>, HTMLUListElement>;
      var: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      video: React.DetailedHTMLProps<React.VideoHTMLAttributes<HTMLVideoElement>, HTMLVideoElement>;
      wbr: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      webview: React.DetailedHTMLProps<React.WebViewHTMLAttributes<HTMLWebViewElement>, HTMLWebViewElement>;

      // SVG Elements
      svg: React.SVGProps<SVGSVGElement>;
      animate: React.SVGProps<SVGElement>;
      animateMotion: React.SVGProps<SVGElement>;
      animateTransform: React.SVGProps<SVGElement>;
      circle: React.SVGProps<SVGCircleElement>;
      clipPath: React.SVGProps<SVGClipPathElement>;
      defs: React.SVGProps<SVGDefsElement>;
      desc: React.SVGProps<SVGDescElement>;
      ellipse: React.SVGProps<SVGEllipseElement>;
      feBlend: React.SVGProps<SVGFEBlendElement>;
      feColorMatrix: React.SVGProps<SVGFEColorMatrixElement>;
      feComponentTransfer: React.SVGProps<SVGFEComponentTransferElement>;
      feComposite: React.SVGProps<SVGFECompositeElement>;
      feConvolveMatrix: React.SVGProps<SVGFEConvolveMatrixElement>;
      feDiffuseLighting: React.SVGProps<SVGFEDiffuseLightingElement>;
      feDisplacementMap: React.SVGProps<SVGFEDisplacementMapElement>;
      feDistantLight: React.SVGProps<SVGFEDistantLightElement>;
      feDropShadow: React.SVGProps<SVGFEDropShadowElement>;
      feFlood: React.SVGProps<SVGFEFloodElement>;
      feFuncA: React.SVGProps<SVGFEFuncAElement>;
      feFuncB: React.SVGProps<SVGFEFuncBElement>;
      feFuncG: React.SVGProps<SVGFEFuncGElement>;
      feFuncR: React.SVGProps<SVGFEFuncRElement>;
      feGaussianBlur: React.SVGProps<SVGFEGaussianBlurElement>;
      feImage: React.SVGProps<SVGFEImageElement>;
      feMerge: React.SVGProps<SVGFEMergeElement>;
      feMergeNode: React.SVGProps<SVGFEMergeNodeElement>;
      feMorphology: React.SVGProps<SVGFEMorphologyElement>;
      feOffset: React.SVGProps<SVGFEOffsetElement>;
      fePointLight: React.SVGProps<SVGFEPointLightElement>;
      feSpecularLighting: React.SVGProps<SVGFESpecularLightingElement>;
      feSpotLight: React.SVGProps<SVGFESpotLightElement>;
      feTile: React.SVGProps<SVGFETileElement>;
      feTurbulence: React.SVGProps<SVGFETurbulenceElement>;
      filter: React.SVGProps<SVGFilterElement>;
      foreignObject: React.SVGProps<SVGForeignObjectElement>;
      g: React.SVGProps<SVGGElement>;
      image: React.SVGProps<SVGImageElement>;
      line: React.SVGProps<SVGLineElement>;
      linearGradient: React.SVGProps<SVGLinearGradientElement>;
      marker: React.SVGProps<SVGMarkerElement>;
      mask: React.SVGProps<SVGMaskElement>;
      metadata: React.SVGProps<SVGMetadataElement>;
      mpath: React.SVGProps<SVGElement>;
      path: React.SVGProps<SVGPathElement>;
      pattern: React.SVGProps<SVGPatternElement>;
      polygon: React.SVGProps<SVGPolygonElement>;
      polyline: React.SVGProps<SVGPolylineElement>;
      radialGradient: React.SVGProps<SVGRadialGradientElement>;
      rect: React.SVGProps<SVGRectElement>;
      stop: React.SVGProps<SVGStopElement>;
      switch: React.SVGProps<SVGSwitchElement>;
      symbol: React.SVGProps<SVGSymbolElement>;
      text: React.SVGProps<SVGTextElement>;
      textPath: React.SVGProps<SVGTextPathElement>;
      tspan: React.SVGProps<SVGTSpanElement>;
      use: React.SVGProps<SVGUseElement>;
      view: React.SVGProps<SVGViewElement>;
    }
  }
  
  // Add missing React attribute interfaces
  namespace React {
    interface AreaHTMLAttributes<T> extends HTMLAttributes<T> {
      alt?: string; coords?: string; download?: any; href?: string;
      hrefLang?: string; media?: string; referrerPolicy?: string;
      rel?: string; shape?: string; target?: string;
    }
    
    interface BaseHTMLAttributes<T> extends HTMLAttributes<T> {
      href?: string; target?: string;
    }
    
    interface BlockquoteHTMLAttributes<T> extends HTMLAttributes<T> {
      cite?: string;
    }
    
    interface CanvasHTMLAttributes<T> extends HTMLAttributes<T> {
      height?: number | string; width?: number | string;
    }
    
    interface ColHTMLAttributes<T> extends HTMLAttributes<T> {
      span?: number; width?: number | string;
    }
    
    interface ColgroupHTMLAttributes<T> extends HTMLAttributes<T> {
      span?: number;
    }
    
    interface DataHTMLAttributes<T> extends HTMLAttributes<T> {
      value?: string | ReadonlyArray<string> | number;
    }
    
    interface DelHTMLAttributes<T> extends HTMLAttributes<T> {
      cite?: string; dateTime?: string;
    }
    
    interface DetailsHTMLAttributes<T> extends HTMLAttributes<T> {
      open?: boolean;
    }
    
    interface DialogHTMLAttributes<T> extends HTMLAttributes<T> {
      open?: boolean;
    }
    
    interface EmbedHTMLAttributes<T> extends HTMLAttributes<T> {
      height?: number | string; src?: string; type?: string; width?: number | string;
    }
    
    interface FieldsetHTMLAttributes<T> extends HTMLAttributes<T> {
      disabled?: boolean; form?: string; name?: string;
    }
    
    interface HtmlHTMLAttributes<T> extends HTMLAttributes<T> {
      manifest?: string;
    }
    
    interface IframeHTMLAttributes<T> extends HTMLAttributes<T> {
      allow?: string; allowFullScreen?: boolean; allowTransparency?: boolean;
      frameBorder?: number | string; height?: number | string;
      loading?: "eager" | "lazy"; marginHeight?: number; marginWidth?: number;
      name?: string; referrerPolicy?: string; sandbox?: string;
      scrolling?: string; seamless?: boolean; src?: string;
      srcDoc?: string; width?: number | string;
    }
    
    interface InsHTMLAttributes<T> extends HTMLAttributes<T> {
      cite?: string; dateTime?: string;
    }
    
    interface KeygenHTMLAttributes<T> extends HTMLAttributes<T> {
      autoFocus?: boolean; challenge?: string; disabled?: boolean;
      form?: string; keyType?: string; keyParams?: string; name?: string;
    }
    
    interface LabelHTMLAttributes<T> extends HTMLAttributes<T> {
      form?: string; htmlFor?: string;
    }
    
    interface LinkHTMLAttributes<T> extends HTMLAttributes<T> {
      as?: string; crossOrigin?: string; href?: string; hrefLang?: string;
      integrity?: string; media?: string; referrerPolicy?: string;
      rel?: string; sizes?: string; type?: string;
    }
    
    interface MapHTMLAttributes<T> extends HTMLAttributes<T> {
      name?: string;
    }
    
    interface MenuHTMLAttributes<T> extends HTMLAttributes<T> {
      type?: string;
    }
    
    interface MetaHTMLAttributes<T> extends HTMLAttributes<T> {
      charSet?: string; content?: string; httpEquiv?: string; name?: string;
    }
    
    interface MeterHTMLAttributes<T> extends HTMLAttributes<T> {
      form?: string; high?: number; low?: number; max?: number | string;
      min?: number | string; optimum?: number; value?: string | ReadonlyArray<string> | number;
    }
    
    interface ObjectHTMLAttributes<T> extends HTMLAttributes<T> {
      classID?: string; data?: string; form?: string; height?: number | string;
      name?: string; type?: string; useMap?: string; width?: number | string;
      wmode?: string;
    }
    
    interface OptgroupHTMLAttributes<T> extends HTMLAttributes<T> {
      disabled?: boolean; label?: string;
    }
    
    interface OutputHTMLAttributes<T> extends HTMLAttributes<T> {
      form?: string; htmlFor?: string; name?: string;
    }
    
    interface ParamHTMLAttributes<T> extends HTMLAttributes<T> {
      name?: string; value?: string | ReadonlyArray<string> | number;
    }
    
    interface ProgressHTMLAttributes<T> extends HTMLAttributes<T> {
      max?: number | string; value?: string | ReadonlyArray<string> | number;
    }
    
    interface QuoteHTMLAttributes<T> extends HTMLAttributes<T> {
      cite?: string;
    }
    
    interface ScriptHTMLAttributes<T> extends HTMLAttributes<T> {
      async?: boolean; charSet?: string; crossOrigin?: string;
      defer?: boolean; integrity?: string; noModule?: boolean;
      nonce?: string; referrerPolicy?: string; src?: string; type?: string;
    }
    
    interface SourceHTMLAttributes<T> extends HTMLAttributes<T> {
      media?: string; sizes?: string; src?: string; srcSet?: string; type?: string;
    }
    
    interface StyleHTMLAttributes<T> extends HTMLAttributes<T> {
      media?: string; nonce?: string; scoped?: boolean; type?: string;
    }
    
    interface TimeHTMLAttributes<T> extends HTMLAttributes<T> {
      dateTime?: string;
    }
    
    interface TrackHTMLAttributes<T> extends HTMLAttributes<T> {
      default?: boolean; kind?: string; label?: string; src?: string; srcLang?: string;
    }
    
    interface WebViewHTMLAttributes<T> extends HTMLAttributes<T> {
      allowFullScreen?: boolean; autoFocus?: boolean; autosize?: boolean;
      blinkfeatures?: string; disableblinkfeatures?: string; disableguestresize?: boolean;
      disablewebsecurity?: boolean; guestinstance?: string; httpreferrer?: string;
      nodeintegration?: boolean; partition?: string; plugins?: boolean;
      preload?: string; src?: string; useragent?: string; webpreferences?: string;
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
