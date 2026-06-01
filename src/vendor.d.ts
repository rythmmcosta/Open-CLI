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
