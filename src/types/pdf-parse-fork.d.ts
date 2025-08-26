declare module 'pdf-parse-fork' {
  interface PDFData {
    text: string;
    numpages: number;
    numrender: number;
    info: any;
    metadata: any;
    version: string;
  }

  function pdf(buffer: Buffer, options?: any): Promise<PDFData>;
  
  export = pdf;
}