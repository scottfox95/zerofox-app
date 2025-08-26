declare module 'turndown' {
  interface Options {
    headingStyle?: 'setext' | 'atx';
    codeBlockStyle?: 'indented' | 'fenced';
    [key: string]: any;
  }

  class TurndownService {
    constructor(options?: Options);
    turndown(html: string): string;
  }

  export = TurndownService;
}