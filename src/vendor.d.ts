declare module 'gradient-string' {
  interface GradientFunction {
    (text: string): string;
  }
  function gradient(colors: string[]): GradientFunction;
  function gradient(...colors: string[]): GradientFunction;
  export = gradient;
}

declare module 'marked-terminal' {
  class TerminalRenderer {
    constructor(options?: Record<string, unknown>);
  }
  export = TerminalRenderer;
}

declare module 'chokidar' {
  interface FSWatcher {
    on(event: 'add' | 'change' | 'unlink' | 'error' | 'ready', listener: (p: string) => void): this;
    close(): Promise<void>;
  }
  interface WatchOptions { ignored?: RegExp | string; persistent?: boolean; ignoreInitial?: boolean; }
  function watch(paths: string | string[], options?: WatchOptions): FSWatcher;
}

declare module 'node-cron' {
  interface ScheduledTask { stop(): void; start(): void; destroy(): void; }
  function schedule(expr: string, fn: () => void, opts?: Record<string, unknown>): ScheduledTask;
  function validate(expr: string): boolean;
}
